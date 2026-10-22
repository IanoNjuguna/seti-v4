/**
 * The charge object — one shape that a hosted page, a public API and an MCP tool
 * all render, and the rules that decide what it says.
 *
 * ## Why this file exists before any surface does
 *
 * Seti's surfaces are payer-side: a merchant with an account scans a QR and is
 * paid. Nothing let a stranger on the internet be paid. The moment three surfaces
 * (wallet URI, hosted page, API) each carry their own copy of "what a charge is"
 * and "when is it paid", three slightly different ideas of `paid` get shipped and
 * the difference is discovered by a customer, not by us.
 *
 * So the object is frozen here first: the type, the canonical EIP-712 signing
 * payload, the status enum, the legal transitions, the customer-facing wording,
 * and a PURE classifier that turns (charge, observed transfer) into the next
 * status or a refusal code. No route, no database, no webhook — those are #131,
 * and they render what this module decides. Nothing here knows about Prisma, the
 * chain, or a user.
 *
 * ## The signature is the whole integrity story
 *
 * A charge link is forwarded, screenshotted, and pasted into group chats. Without
 * a signature over the amount, an edited link is a payment to the wrong number
 * with no way to tell. The recipient's own key signs
 * `{recipient, asset, amount, memo, id, expiresAt, nonce}` and every consumer
 * re-verifies before it renders or classifies — see {@link chargeVerifies}.
 *
 * `scope` is deliberately OUTSIDE that signature in v1. See
 * {@link CHARGE_SIGNED_FIELDS} and `docs/internal/charge-object.md`.
 *
 * ## Order: what is actually pinned
 *
 * EIP-712 hashes a struct's fields in the order the TYPE NAME sort puts them in,
 * which is alphabetical by field name — not the order they are declared in
 * {@link CHARGE_TYPES}. So two implementations cannot disagree about the HASH as
 * long as they agree on the field SET, the field TYPES and the domain, and
 * `charge.check.ts` proves that by re-hashing the same payload with its keys
 * inserted in a different order.
 *
 * What order still matters for, and why it is written down: the payload object a
 * wallet displays, an API returns, and a log line prints. Those are read by humans
 * and by tests that compare keys, so {@link chargeSigningPayload} emits exactly
 * {@link CHARGE_SIGNED_FIELDS} in exactly that order, and the check asserts the
 * emitted keys deep-equal that tuple. A field added to the type but not to the
 * tuple (or the reverse) fails the check rather than silently changing what four
 * surfaces render.
 */
import {
  getAddress,
  hashTypedData,
  parseUnits,
  recoverTypedDataAddress,
  verifyTypedData,
  type Address,
  type Hex,
} from 'viem';
import { ASSET_DECIMALS, type SupportedAsset } from '../config/assets.js';
import type { PaymentRefusalCode } from './payment-refusal.js';

/**
 * The version of this contract, not of any one charge.
 *
 * It moves when the SIGNED SET, the status enum or the classifier's rules change —
 * i.e. when something a stored signature or a stored row depends on changes. The
 * document that describes it (`docs/internal/charge-object.md`) carries the same
 * number.
 */
export const CHARGE_SPEC_VERSION = '1';

/** How long a charge is live by default, before it is inert. 24 hours. */
export const CHARGE_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// The object
// ---------------------------------------------------------------------------

/**
 * Every status a charge can be in.
 *
 * There is no `paid_out` and no refund state, because Seti never holds the funds:
 * a payment is a transfer straight to the recipient, so "the money reached the
 * merchant" is the same event as "the customer paid". And there is no
 * `partially_paid` because underpaid is TERMINAL — topping up is a second charge,
 * not a second transfer against this one.
 */
export const CHARGE_STATUSES = ['pending', 'paid', 'underpaid', 'overpaid', 'expired'] as const;

export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

/**
 * The fields of a charge that are NOT covered by the signature, and why that is
 * safe: they are all derived, never asserted.
 *
 * - `scope`, `status`, `txHash` change after signing by design (the whole point of
 *   a charge is that its status moves), so signing them would mean a re-signature
 *   per state change and no wallet would approve one.
 * - `signature` cannot sign itself.
 *
 * The rule that makes this safe is that nothing reads them as authority: the
 * recipient, amount, asset, memo, id, expiry and nonce — the things that decide
 * where money goes — are all signed.
 */
export interface ChargeFields {
  /** The charge's own id. Also the thing `memo` carries, and the matching key. */
  id: string;
  /** The payee. Signed, and the only authority on where the money goes. */
  recipient: `0x${string}`;
  /** The Seti ledger label (`ousd`), not a token address: the domain binds the chain. */
  asset: SupportedAsset;
  /**
   * The amount owed, as a decimal string in token units (`"250.000000"`).
   *
   * A string, never a number: token units are 6 decimals, the ledger stores decimal
   * strings, and `0.1 + 0.2` in a float is how an amount becomes a cent wrong. A
   * `uint256` of base units was rejected because every surface in this product
   * shows decimals, and a silent 1e6 error is the classic failure of that shape.
   */
  amount: string;
  /** Free text the payer sees, and the field that CARRIES `id` for matching. */
  memo: string;
  /** ISO 8601. Past this instant the charge is inert. Signed. */
  expiresAt: string;
  /** Single-use value, so two charges are never the same signature. Signed. */
  nonce: string;
  /**
   * RESERVED AND UNSIGNED in v1: the URL or route this charge is for
   * (`GET /v1/report`, `https://shop.example/checkout`).
   *
   * It exists now so the machine-payment adapter (HTTP 402, MPP, x402) does not
   * have to reopen this schema after three surfaces render it, and it stays out of
   * the signature until there is a reason to bind it: when it does get signed, the
   * reason will be narrow — proving the merchant controls the endpoint. A field
   * that is present and ignored costs nothing; a field added after three surfaces
   * render the object costs three migrations.
   */
  scope: string | null;
}

/** A charge with its signature — what a signer hands over and a verifier checks. */
export interface SignedCharge extends ChargeFields {
  /** EIP-712 signature by `recipient`, over {@link chargeSigningPayload}. */
  signature: string;
}

/** A charge as every surface renders it. */
export interface Charge extends SignedCharge {
  status: ChargeStatus;
  /** The transfer that settled it, once one has. Never signed, never authority. */
  txHash: string | null;
}

// ---------------------------------------------------------------------------
// The canonical signing payload. THIS is the contract.
// ---------------------------------------------------------------------------

/**
 * The signed fields, in the canonical order, exactly as the issue names them.
 *
 * Excluded on purpose, each for a reason:
 *
 * - `scope` — reserved and unsigned in v1 (see {@link ChargeFields.scope}).
 * - `signature` — it cannot cover itself.
 * - `status`, `txHash` — they change after signing, and neither is authority: the
 *   on-chain receipt is.
 *
 * A field missing here and present in a surface's copy of the object is a bug with
 * no failure mode until someone forges it, which is why `charge.check.ts` asserts
 * this tuple against both the EIP-712 types and the emitted payload.
 */
export const CHARGE_SIGNED_FIELDS = [
  'recipient',
  'asset',
  'amount',
  'memo',
  'id',
  'expiresAt',
  'nonce',
] as const;

export type ChargeSignedField = (typeof CHARGE_SIGNED_FIELDS)[number];

/**
 * The message a wallet is asked to sign: exactly the seven signed fields, nothing
 * else. Strings and one address, so every value displays literally in a wallet
 * instead of as a base-unit integer the payer cannot read.
 */
export interface ChargeSigningPayload {
  /** An EVM address — typed as one so a truncated address cannot be signed silently. */
  recipient: `0x${string}`;
  asset: string;
  amount: string;
  memo: string;
  id: string;
  expiresAt: string;
  nonce: string;
}

/** The EIP-712 domain name. The same `Seti` a handle claim signs under. */
export const CHARGE_DOMAIN_NAME = 'Seti';
/** The domain version. Bumped only if the DOMAIN changes, never for a message edit. */
export const CHARGE_DOMAIN_VERSION = '1';
/** The EIP-712 struct name. */
export const CHARGE_PRIMARY_TYPE = 'Charge';

/**
 * The struct definition — the declared field SET and TYPES.
 *
 * Written in the canonical order for legibility. EIP-712 hashes the fields sorted
 * by NAME (`amount, asset, expiresAt, id, memo, nonce, recipient`) whatever order
 * they appear in here, so this array's order is documentation: the load-bearing
 * facts are which fields are present and what type each has.
 *
 * Types chosen deliberately:
 * - `recipient` is `address`, so a truncated or mis-cased address is a signing
 *   error rather than a rendered lie.
 * - `asset` is `string` (the ledger label) rather than an enum or an address: an
 *   address belongs to a chain and the domain already pins the chain, and an enum
 *   in a signed struct would mean a new schema per supported token.
 * - `amount`, `expiresAt`, `nonce`, `id`, `memo` are `string` so the signed bytes
 *   are exactly what the payer reads.
 */
export const CHARGE_TYPES = {
  [CHARGE_PRIMARY_TYPE]: [
    { name: 'recipient', type: 'address' },
    { name: 'asset', type: 'string' },
    { name: 'amount', type: 'string' },
    { name: 'memo', type: 'string' },
    { name: 'id', type: 'string' },
    { name: 'expiresAt', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

export interface ChargeDomain {
  name: string;
  version: string;
  chainId: number;
}

/**
 * The domain a charge is signed under, for one chain.
 *
 * The chain id is passed in rather than read from the environment, so this module
 * stays pure and so a mainnet charge and a practice charge are different
 * signatures that cannot be replayed across chains.
 */
export function chargeDomain(chainId: number): ChargeDomain {
  return { name: CHARGE_DOMAIN_NAME, version: CHARGE_DOMAIN_VERSION, chainId };
}

/**
 * The exact message for a charge: the seven signed fields in canonical order.
 *
 * This function is the single producer of the signed message. A surface that
 * builds its own object and signs it — or verifies against one — diverges here.
 */
export function chargeSigningPayload(charge: ChargeFields): ChargeSigningPayload {
  return {
    recipient: charge.recipient,
    asset: charge.asset,
    amount: charge.amount,
    memo: charge.memo,
    id: charge.id,
    expiresAt: charge.expiresAt,
    nonce: charge.nonce,
  };
}

/** The EIP-712 digest a signature covers. Local crypto: no I/O, no chain read. */
export function chargeDigest(charge: ChargeFields, chainId: number): Hex {
  return hashTypedData({
    domain: chargeDomain(chainId),
    types: CHARGE_TYPES,
    primaryType: CHARGE_PRIMARY_TYPE,
    message: chargeSigningPayload(charge),
  });
}

/** The EIP-712 typed data for a stored charge, for verification. */
function chargeVerification(charge: SignedCharge, chainId: number) {
  return {
    domain: chargeDomain(chainId),
    types: CHARGE_TYPES,
    primaryType: CHARGE_PRIMARY_TYPE,
    message: chargeSigningPayload(charge),
    signature: charge.signature as Hex,
  } as const;
}

/**
 * Who signed this charge, or `null` when the signature cannot be read.
 *
 * Derived from the charge's OWN fields plus the signature, so an edited field
 * changes the recovered address — that is the tamper detection, not a comparison
 * of stored strings.
 *
 * `async` because viem's public recovery API is: the same instrument
 * `handle-claims.ts` verifies a Seti name with. It does no I/O — this module still
 * touches no chain, no database and no user — and a signature that cannot be read
 * is simply `null`, never a thrown viem error leaking into a refusal.
 */
export async function recoverChargeSigner(
  charge: SignedCharge,
  chainId: number
): Promise<Address | null> {
  try {
    return await recoverTypedDataAddress(chargeVerification(charge, chainId));
  } catch {
    return null;
  }
}

/**
 * Does this charge's signature come from the key that controls `recipient`?
 *
 * Every surface asks this before it renders a charge, and the classifier asks it
 * again before it calls anything paid. A signature from anyone else means the link
 * was edited in flight, and the amount on the page is not the amount that was
 * signed.
 *
 * An unusable recipient address is `false`, not a throw: a charge nobody signed for
 * is not a charge, and the refusal belongs to this module's vocabulary.
 */
export async function chargeVerifies(charge: SignedCharge, chainId: number): Promise<boolean> {
  try {
    return await verifyTypedData({
      ...chargeVerification(charge, chainId),
      address: getAddress(charge.recipient),
    });
  } catch {
    return false;
  }
}

/** Convenience for the signing side: the domain to hand a wallet, typed for viem. */
export function chargeTypedData(charge: ChargeFields, chainId: number) {
  return {
    domain: chargeDomain(chainId),
    types: CHARGE_TYPES,
    primaryType: CHARGE_PRIMARY_TYPE,
    message: chargeSigningPayload(charge),
  } as const;
}

// ---------------------------------------------------------------------------
// Status: the enum, the transitions, and the one place the words live
// ---------------------------------------------------------------------------

/**
 * The legal transitions.
 *
 * `pending` is the only state with outgoing edges, and no terminal state has any:
 * a second transfer against a paid charge is a NEW charge, not a paid charge
 * becoming overpaid. That asymmetry is the whole rule — "nothing leaves a terminal
 * state" — and it is expressed here once rather than checked per surface.
 */
export const CHARGE_TRANSITIONS: Record<ChargeStatus, readonly ChargeStatus[]> = {
  pending: ['paid', 'underpaid', 'overpaid', 'expired'],
  paid: [],
  underpaid: [],
  overpaid: [],
  expired: [],
};

/** Whether `to` is reachable from `from`. */
export function canTransition(from: ChargeStatus, to: ChargeStatus): boolean {
  return CHARGE_TRANSITIONS[from].includes(to);
}

/** A status with no outgoing edges: the charge is decided and stays decided. */
export function isTerminal(status: ChargeStatus): boolean {
  return CHARGE_TRANSITIONS[status].length === 0;
}

/** One status's customer-facing wording. */
export interface ChargeStatusCopy {
  /** A chip or badge: one or two words. */
  label: string;
  /** The headline on the page. */
  headline: string;
  /** One sentence saying what happened and what, if anything, to do next. */
  detail: string;
}

/**
 * What each status SAYS, in one place.
 *
 * A page, an API response and an MCP tool all render a charge, so each of them
 * would otherwise write its own sentence for `underpaid` and they would drift. The
 * words are the product's, and they are here: the API sends them, the page shows
 * them, nothing invents a fourth.
 *
 * Rules the wording follows:
 *
 * - It is written to the PAYER, who is a stranger holding a link.
 * - `underpaid` says the money is final and cannot be topped up, because that is
 *   the decision (no partial fills) and the payer has to know it now.
 * - `overpaid` never implies a refund will happen, because none will.
 * - `expired` says nothing was paid, so the payer is not left wondering.
 */
export const CHARGE_STATUS_COPY: Record<ChargeStatus, ChargeStatusCopy> = {
  pending: {
    label: 'Awaiting payment',
    headline: 'Waiting for payment',
    detail:
      'Send exactly this amount before the link expires. This page updates on its own when the payment arrives.',
  },
  paid: {
    label: 'Paid',
    headline: 'Payment received',
    detail: 'The full amount arrived. Nothing else is needed.',
  },
  underpaid: {
    label: 'Underpaid',
    headline: 'Less than the full amount arrived',
    detail:
      'This payment is final and cannot be topped up. Ask for a new charge for the difference.',
  },
  overpaid: {
    label: 'Overpaid',
    headline: 'More than the full amount arrived',
    detail:
      'The payment is recorded at the amount that actually arrived. Nothing is refunded automatically.',
  },
  expired: {
    label: 'Expired',
    headline: 'This link has expired',
    detail: 'Nothing was paid on this link. Ask for a new one to pay now.',
  },
};

/** The wording for a status. Total over {@link ChargeStatus}, so there is no gap. */
export function chargeStatusCopy(status: ChargeStatus): ChargeStatusCopy {
  return CHARGE_STATUS_COPY[status];
}

/**
 * Is this charge past its expiry at `now`?
 *
 * An UNREADABLE `expiresAt` counts as expired: it is not evidence that a charge is
 * live, and the fail-closed direction for a payment link is the inert one.
 */
export function chargeIsExpired(charge: ChargeFields, now: Date): boolean {
  const expiresAt = Date.parse(charge.expiresAt);
  if (Number.isNaN(expiresAt)) return true;
  return now.getTime() >= expiresAt;
}

/** The expiry a charge created at `issuedAt` gets by default. */
export function defaultChargeExpiry(issuedAt: Date): string {
  return new Date(issuedAt.getTime() + CHARGE_DEFAULT_TTL_MS).toISOString();
}

// ---------------------------------------------------------------------------
// The classifier
// ---------------------------------------------------------------------------

/**
 * The charge path's refusal codes.
 *
 * Codes, never prose, and they live in the ONE taxonomy
 * (`payment-refusal.ts`) rather than a second vocabulary of their own — so a
 * surface that already renders a refusal code renders these too, and support has
 * one list to search. The codes that a payment already had and a charge reuses
 * (`receipt-unavailable`, `amount-invalid`) are the SAME codes, deliberately: an
 * unconfirmed transfer is an unconfirmed transfer whichever object asked.
 */
export type ChargeRefusalCode =
  /** The charge is already decided. A second transfer is a new charge. */
  | 'charge-not-pending'
  /** The signature does not recover to `recipient`: the link was edited in flight. */
  | 'charge-signature-invalid'
  /** Past `expiresAt` (or an expiry that cannot be read) — the link is inert. */
  | 'charge-expired'
  /** The chain has no usable receipt for the transfer yet. */
  | 'receipt-unavailable'
  /** The transfer paid someone other than the charge's recipient. */
  | 'recipient-mismatch'
  /** The transfer moved a different token than the charge names. */
  | 'asset-mismatch'
  /** The transfer's memo does not carry the charge id, so it cannot be matched. */
  | 'memo-missing-charge-id'
  /** The charge's or the transfer's amount is not a usable decimal amount. */
  | 'amount-invalid';

/** Compile-time proof these codes are PART of the payment taxonomy, not beside it. */
type ChargeRefusalsArePaymentRefusals = ChargeRefusalCode extends PaymentRefusalCode ? true : never;
const _refusalTaxonomy: ChargeRefusalsArePaymentRefusals = true;

/**
 * An observed transfer: what the chain says landed, and nothing else.
 *
 * Deliberately not a `Transaction`: this module must be decidable from a receipt
 * that no database has seen, which is what makes the classifier testable and what
 * lets the indexer and the API share it.
 */
export interface ObservedTransfer {
  txHash: string;
  /** The `to` the chain recorded. */
  recipient: string;
  /** The Seti ledger label of the token that moved (`ousd`). */
  asset: string;
  /** Decimal token units, as a string — the same shape as {@link ChargeFields.amount}. */
  amount: string;
  /** The transfer's own memo/reference text, which must carry the charge id. */
  memo: string;
  /** The receipt exists and succeeded. An unmined transfer decides nothing. */
  confirmed: boolean;
}

/** What the classifier concluded. */
export type ChargeDecision =
  | {
      ok: true;
      /** The status this charge moves to. Always a legal transition. */
      status: ChargeStatus;
      /** Signed token units: observed − expected. Positive is overpaid. */
      deltaUnits: bigint;
      /** The tolerance applied, in token units. */
      toleranceUnits: bigint;
    }
  | {
      ok: false;
      /** The machine-readable reason. Branch on THIS, never on `reason`. */
      code: ChargeRefusalCode;
      /** One sentence for a log or a support tool. Never the contract. */
      reason: string;
    };

/** The tolerance `recordPayment` already applies: 1% of the charge's amount. */
export const CHARGE_TOLERANCE_PERCENT = 1;

/**
 * Decimal token units, or null when the string is not a usable amount.
 *
 * Integers at {@link ASSET_DECIMALS}, not floats: the 1% boundary has to be
 * EXACTLY representable or "exactly 1% under is accepted" is untestable — and
 * float subtraction on the cent boundary is how `<=` and `<` disagree between
 * runs.
 */
function amountUnits(amount: string): bigint | null {
  if (typeof amount !== 'string' || amount.trim() === '') return null;
  try {
    const units = parseUnits(amount.trim(), ASSET_DECIMALS);
    return units >= 0n ? units : null;
  } catch {
    return null;
  }
}

/** Absolute value, for the symmetric comparison. */
function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/** A refusal, in the shape the taxonomy uses: code plus one sentence. */
function refuse(code: ChargeRefusalCode, reason: string): ChargeDecision {
  return { ok: false, code, reason };
}

/**
 * Decide a charge's next status from a charge and an observed transfer, or refuse.
 *
 * PURE: no chain read, no database, no user, no clock of its own (`now` is passed
 * in). Every rule the product applies before it calls a charge paid is here and in
 * no other place, which is the point — `check:charge` drives this function and the
 * fixtures at the boundary are the specification.
 *
 * `async` only because signature verification is: the crypto is local, nothing is
 * fetched, and a caller can decide a charge from a receipt that no database has
 * seen.
 *
 * The order of the gates is deliberate:
 *
 *  1. **Is this charge still undecided?** A decided charge cannot move, so a second
 *     matching transfer is refused rather than turning `paid` into `overpaid`.
 *  2. **Does its signature verify?** Nothing else about a forged charge is worth
 *     classifying: if `recipient` or `amount` was edited in flight, "underpaid" is a
 *     sentence about a lie.
 *  3. **Is it still live?** An expired link is inert whatever arrived.
 *  4. **Is the transfer confirmed?** An unmined transfer decides nothing.
 *  5. **Is it the right payee and the right token?** Cheap, exact, and both are
 *     refusals rather than statuses: a transfer to another address is not this
 *     charge's money at all.
 *  6. **Does the memo carry the id?** Without it a reused link cannot be told apart
 *     from an unrelated transfer, and a TIP-20 transfer has no other identifier.
 *  7. **How much moved, against 1%?** Within tolerance is `paid`; outside it is
 *     `underpaid` or `overpaid`.
 *
 * The amount comparison uses 1% of the CHARGE's amount — the same figure and the
 * same direction `recordPayment` uses (`|observed − claimed| > claimed × 1%`) so a
 * charge and a payment can never disagree about whether an amount is close enough.
 * The tolerance is floored to whole token units, which can only make it a hair
 * TIGHTER than 1%, never looser.
 */
export async function classifyCharge(input: {
  charge: SignedCharge & { status: ChargeStatus };
  transfer: ObservedTransfer;
  chainId: number;
  now: Date;
}): Promise<ChargeDecision> {
  const { charge, transfer, chainId, now } = input;

  // 1. A decided charge stays decided.
  if (isTerminal(charge.status)) {
    return refuse(
      'charge-not-pending',
      `Charge ${charge.id} is already ${charge.status}, and nothing leaves a terminal state.`
    );
  }

  // 2. Integrity. A charge that does not verify is not a charge.
  if (!(await chargeVerifies(charge, chainId))) {
    return refuse(
      'charge-signature-invalid',
      `The signature on charge ${charge.id} does not come from ${charge.recipient}, ` +
        'so the amount and memo on it were not signed by the payee.'
    );
  }

  // 3. Time.
  if (chargeIsExpired(charge, now)) {
    return refuse(
      'charge-expired',
      `Charge ${charge.id} expired at ${charge.expiresAt}, so this link is inert.`
    );
  }

  // 4. The chain has to have it.
  if (!transfer.confirmed) {
    return refuse(
      'receipt-unavailable',
      `Transfer ${transfer.txHash} is not confirmed yet, so it cannot settle anything.`
    );
  }

  // 5. Payee, then token.
  if (!sameAddress(transfer.recipient, charge.recipient)) {
    return refuse(
      'recipient-mismatch',
      `Transfer ${transfer.txHash} paid ${transfer.recipient}, not charge ${charge.id}'s recipient ${charge.recipient}.`
    );
  }

  if (transfer.asset !== charge.asset) {
    return refuse(
      'asset-mismatch',
      `Transfer ${transfer.txHash} moved ${transfer.asset}, and charge ${charge.id} is for ${charge.asset}.`
    );
  }

  // 6. Matchability. Without the id in the memo a reused link cannot be told from
  //    an unrelated transfer, and a TIP-20 transfer carries no other identifier.
  if (!transfer.memo.includes(charge.id)) {
    return refuse(
      'memo-missing-charge-id',
      `Transfer ${transfer.txHash} does not carry charge ${charge.id} in its memo, so it cannot be matched to it.`
    );
  }

  // 7. Amount, against 1%.
  const expected = amountUnits(charge.amount);
  if (expected === null) {
    return refuse('amount-invalid', `Charge ${charge.id} carries "${charge.amount}", which is not an amount.`);
  }

  const observed = amountUnits(transfer.amount);
  if (observed === null) {
    return refuse(
      'amount-invalid',
      `Transfer ${transfer.txHash} carries "${transfer.amount}", which is not an amount.`
    );
  }

  const tolerance = (expected * BigInt(CHARGE_TOLERANCE_PERCENT)) / 100n;
  const delta = observed - expected;

  if (abs(delta) <= tolerance) {
    return { ok: true, status: 'paid', deltaUnits: delta, toleranceUnits: tolerance };
  }

  return {
    ok: true,
    status: delta < 0n ? 'underpaid' : 'overpaid',
    deltaUnits: delta,
    toleranceUnits: tolerance,
  };
}

/**
 * The next status for a decision, checked against the transition table.
 *
 * Exists so a caller cannot apply a status the classifier produced for a different
 * charge's state: `null` means the table forbids it, and the caller refuses rather
 * than writing an illegal state.
 */
export function nextChargeStatus(
  from: ChargeStatus,
  decision: ChargeDecision
): ChargeStatus | null {
  if (!decision.ok) return null;
  return canTransition(from, decision.status) ? decision.status : null;
}

/**
 * Case-insensitive address comparison that treats an unusable address as a
 * mismatch rather than throwing inside a decision.
 */
function sameAddress(left: string, right: string): boolean {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  return left.toLowerCase() === right.toLowerCase();
}
