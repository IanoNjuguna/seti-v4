/**
 * Merchant name claims — the cryptographic half of a merchant's identity.
 *
 * ## The product decision this implements
 *
 * A merchant is just a name that a wallet has signed for. There is no code
 * minting, no platform-owned name-to-address table, and no distinction between a
 * merchant and a peer in the money path: a merchant payment and a send are the
 * same two-leg batch. What this module proves is the one thing the platform
 * cannot be trusted to assert on its own — that whoever claims a name CONTROLS
 * the address the name is claimed for.
 *
 * The dangerous design it replaces is a platform-owned code-to-address mapping:
 * whoever can edit a row silently redirects every payment to that code, and the
 * customer never sees an address to notice. Here nobody can attach a name to an
 * address without that address's key. A compromised database can at worst HIDE
 * a name — clear the signature and it reads as unverified; it cannot invent a
 * binding, because a binding is a signature and forging one is not a database
 * write.
 *
 * Identity verification (is this business really Java House?) is deliberately
 * OUT OF SCOPE. The owner verifies that in person or by KYB. This module only
 * ever answers: does this signature, over this name and this address, come from
 * the key that controls the address?
 *
 * ## Why EIP-712 and not a plain message
 *
 * A `personal_sign` of a string is opaque in a wallet: the person approves hex
 * they cannot read. EIP-712 gives the wallet typed fields to display (the name,
 * the address, when it was issued) and domain-separates the signature, so it
 * cannot be replayed against another app or another chain — the domain carries
 * our app name, a version, and the Tempo chain id.
 */
import { getAddress, recoverTypedDataAddress, verifyTypedData } from 'viem';
import { prisma } from '../lib/prisma.js';
import { describeEvmAddress } from '../lib/address.js';
import {
  describeMerchantHandle,
  describeMerchantName,
  merchantHandle,
  merchantNameKey,
  normalizeMerchantName,
} from '../lib/merchant-name.js';
import { network } from '../config/networks.js';
import { getWalletsByUser } from './wallet-registry.js';

/**
 * The name rule itself lives in `lib/merchant-name.ts` (pure, no chain
 * dependency) and is re-exported here so callers of a claim have one import for
 * the whole feature. The rule is shared with the QR parser, which is why it is
 * not defined in this file. `merchantHandle` is the same deal: it owns the
 * `m/<handle>` rule, which the web mirrors in `lib/merchant-link.ts`.
 */
export {
  describeMerchantHandle,
  describeMerchantName,
  merchantHandle,
  merchantNameKey,
  normalizeMerchantName,
} from '../lib/merchant-name.js';

// ---------------------------------------------------------------------------
// The signed shape. Shared by the backend, the browser and the check suite, so
// all three cannot disagree about what was signed.
// ---------------------------------------------------------------------------

export const MERCHANT_CLAIM_DOMAIN_NAME = 'Seti';
export const MERCHANT_CLAIM_DOMAIN_VERSION = '1';
export const MERCHANT_CLAIM_PRIMARY_TYPE = 'MerchantNameClaim';

/** The domain the wallet is asked to sign against. `chainId` is the Tempo one. */
export interface MerchantClaimDomain {
  name: string;
  version: string;
  chainId: number;
}

/** The fields a person sees and approves in their wallet. */
export interface MerchantClaimMessage {
  /** The claimed business name. */
  name: string;
  /** The address the name is claimed FOR — must be the signer's own. */
  address: string;
  /** ISO 8601, chosen by the signer and stored verbatim. */
  issuedAt: string;
  /** One-time value, so two claims are never the same signature. */
  nonce: string;
}

export const MERCHANT_CLAIM_TYPES: Record<string, readonly { name: string; type: string }[]> = {
  MerchantNameClaim: [
    { name: 'name', type: 'string' },
    { name: 'address', type: 'address' },
    { name: 'issuedAt', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
};

/**
 * The EIP-712 domain.
 *
 * Read from the live network config rather than hardcoded, so a testnet claim
 * and a mainnet claim are different signatures and neither can be replayed on
 * the other chain.
 */
export function merchantClaimDomain(): MerchantClaimDomain {
  return {
    name: MERCHANT_CLAIM_DOMAIN_NAME,
    version: MERCHANT_CLAIM_DOMAIN_VERSION,
    chainId: network.chainId,
  };
}

// ---------------------------------------------------------------------------
// Verification — the whole point. Nothing here trusts a stored boolean.
// ---------------------------------------------------------------------------

/**
 * Who signed this claim, or `null` when the signature is unreadable.
 *
 * `null` rather than a thrown viem error: a malformed signature is simply not a
 * match, and the refusal belongs to this module's vocabulary, not viem's.
 */
export async function recoverMerchantClaimAddress(input: {
  message: MerchantClaimMessage;
  signature: string;
}): Promise<`0x${string}` | null> {
  try {
    return await recoverTypedDataAddress({
      domain: merchantClaimDomain(),
      types: MERCHANT_CLAIM_TYPES,
      primaryType: MERCHANT_CLAIM_PRIMARY_TYPE,
      message: { ...input.message },
      signature: input.signature as `0x${string}`,
    });
  } catch {
    return null;
  }
}

/** The stored fields a re-verification needs, and nothing else. */
export interface StoredMerchantClaim {
  name: string;
  payoutAddress: string | null;
  claimSignature: string | null;
  claimIssuedAt: string | null;
  claimNonce: string | null;
}

/**
 * Is the stored binding still genuine?
 *
 * Recomputed from the stored signature and the row's CURRENT name and address —
 * never read from a stored flag. That is what makes tampering visible: change
 * the name or the payout address in the database and the signature no longer
 * recovers to the address, so the row reads as unverified instead of as a
 * verified name pointing somewhere new.
 */
export async function merchantClaimVerifies(merchant: StoredMerchantClaim): Promise<boolean> {
  const { name, payoutAddress, claimSignature, claimIssuedAt, claimNonce } = merchant;

  if (!payoutAddress || !claimSignature || !claimIssuedAt || !claimNonce) return false;

  const recovered = await recoverMerchantClaimAddress({
    message: { name, address: payoutAddress, issuedAt: claimIssuedAt, nonce: claimNonce },
    signature: claimSignature,
  });

  return recovered !== null && recovered.toLowerCase() === payoutAddress.toLowerCase();
}

/** What a client may be told about a merchant, with the verification recomputed. */
export interface MerchantIdentityView {
  id: string;
  name: string;
  /**
   * The stored, unique handle behind `seti.live/m/<handle>`. Null only for a row
   * that predates claims (or a fixture) — a claimed merchant always has one.
   */
  handle: string | null;
  category: string | null;
  /** The authoritative thing. A name is never used without it. */
  payoutAddress: string | null;
  /**
   * True only when a signature over THIS name and THIS address verifies. There
   * is no path that sets this to true by assertion.
   */
  verified: boolean;
  claimedAt: string | null;
}

export async function toMerchantIdentityView(merchant: {
  id: string;
  name: string;
  handle: string | null;
  category: string | null;
  payoutAddress: string | null;
  claimSignature: string | null;
  claimIssuedAt: string | null;
  claimNonce: string | null;
  claimedAt: Date | null;
}): Promise<MerchantIdentityView> {
  return {
    id: merchant.id,
    name: merchant.name,
    handle: merchant.handle,
    category: merchant.category,
    payoutAddress: merchant.payoutAddress,
    verified: await merchantClaimVerifies(merchant),
    claimedAt: merchant.claimedAt ? merchant.claimedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// The claim itself — a one-time act, no gas, nothing written on chain.
// ---------------------------------------------------------------------------

export type MerchantClaimErrorCode =
  | 'invalid-merchant-name'
  | 'invalid-address'
  | 'invalid-issued-at'
  | 'invalid-signature'
  | 'signature-mismatch'
  | 'address-not-owned'
  | 'name-taken'
  | 'handle-taken';

/** A refusal with a machine-readable code, in the envelope the app already reads. */
export class MerchantClaimError extends Error {
  constructor(
    readonly code: MerchantClaimErrorCode,
    readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'MerchantClaimError';
  }
}

export interface ClaimMerchantNameInput {
  /** The authenticated caller. */
  userId: string;
  name: string;
  address: string;
  issuedAt: string;
  nonce: string;
  signature: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Which unique index a P2002 came from, when Prisma names it.
 *
 * The Merchant table has two unique columns that a claim writes — `nameKey` and
 * `handle` — so a bare "P2002 means taken" cannot say WHICH refusal to return.
 * Prisma puts the offending column(s) in `meta.target`; that is what routes the
 * race to `name-taken` or `handle-taken`.
 */
function uniqueViolationTarget(error: unknown): string[] | null {
  const target = (error as { meta?: { target?: unknown } } | null)?.meta?.target;
  return Array.isArray(target) ? target.map(String) : null;
}

/**
 * Claim a name for an address, or refuse with a reason.
 *
 * The order is deliberate: cheap local validation first, then the signature,
 * then ownership, then the collision. A bad name or a bad signature never costs
 * a query, and — more importantly — a caller who does not control the address is
 * refused BEFORE anything is looked up about who else holds the name, so a
 * failed claim cannot be used to probe which names exist.
 */
export async function claimMerchantName(input: ClaimMerchantNameInput) {
  const nameProblem = describeMerchantName(input.name);
  if (nameProblem) throw new MerchantClaimError('invalid-merchant-name', 400, nameProblem);
  // The name is usable, but it must also make a link: a valid name with no `a–z`
  // or digit (`東京`) derives an empty handle, and a claim of `seti.live/m/`
  // names nobody. Refused with the same code as a bad name, because that is the
  // field the person has to fix.
  const handleProblem = describeMerchantHandle(input.name);
  if (handleProblem) throw new MerchantClaimError('invalid-merchant-name', 400, handleProblem);
  const name = normalizeMerchantName(input.name);
  const handle = merchantHandle(input.name);

  const addressProblem = describeEvmAddress(input.address);
  if (addressProblem) throw new MerchantClaimError('invalid-address', 400, addressProblem);
  const claimedAddress = getAddress(input.address);

  if (Number.isNaN(Date.parse(input.issuedAt))) {
    throw new MerchantClaimError(
      'invalid-issued-at',
      400,
      `"${input.issuedAt}" is not a date. Send the issued-at as an ISO 8601 timestamp.`
    );
  }

  const message: MerchantClaimMessage = {
    name,
    address: claimedAddress,
    issuedAt: input.issuedAt,
    nonce: input.nonce,
  };

  // The signature is read once and asked two questions: viem's own
  // `verifyTypedData` (does it verify against the claimed address?) and the
  // recovered signer (whom do we actually check ownership against?). Both must
  // agree, and the recovered address is what the wallet check uses — never the
  // address the client put in the body.
  const matches = await verifyTypedData({
    address: claimedAddress,
    domain: merchantClaimDomain(),
    types: MERCHANT_CLAIM_TYPES,
    primaryType: MERCHANT_CLAIM_PRIMARY_TYPE,
    message: { ...message },
    signature: input.signature as `0x${string}`,
  }).catch(() => false);

  const recovered = await recoverMerchantClaimAddress({ message, signature: input.signature });

  if (!recovered) {
    throw new MerchantClaimError(
      'invalid-signature',
      400,
      'That signature could not be read. Sign the claim again with your wallet.'
    );
  }

  if (!matches || recovered.toLowerCase() !== claimedAddress.toLowerCase()) {
    throw new MerchantClaimError(
      'signature-mismatch',
      400,
      `That signature was produced by ${recovered}, not by the claimed address ${claimedAddress}. ` +
        'A name can only be claimed by the key that controls the address it is claimed for.'
    );
  }

  // Ownership, through the existing registry rather than a second copy of it.
  const wallets = await getWalletsByUser(input.userId);
  const owned = wallets.some(
    (wallet) => wallet.address.toLowerCase() === recovered.toLowerCase()
  );

  if (!owned) {
    throw new MerchantClaimError(
      'address-not-owned',
      403,
      `${recovered} is not one of the wallets registered to your account. ` +
        'Claim with the wallet that will receive the payments.'
    );
  }

  const nameKey = merchantNameKey(name);

  // First-come. The lookup matches on the normalised key AND on the raw name
  // (case-insensitively), because a merchant row written before claims existed
  // may have no key at all — and it must still block a claim it already holds.
  const existing = await prisma.merchant.findFirst({
    where: {
      OR: [{ nameKey }, { name: { equals: name, mode: 'insensitive' } }],
    },
  });

  const heldBy = existing?.payoutAddress ? getAddress(existing.payoutAddress) : null;

  if (existing && heldBy !== claimedAddress) {
    throw new MerchantClaimError(
      'name-taken',
      409,
      `"${existing.name}" is already claimed by ${heldBy ?? 'a merchant with no address'}. ` +
        'Names are first-come: choose another, or claim with the wallet that already holds it.'
    );
  }

  /**
   * The handle is the second, independent uniqueness the link rests on.
   *
   * `handle` is not unique by construction — the rule drops characters — so a
   * distinct NAME can derive a handle another merchant already holds. Without
   * this check both rows would exist and `seti.live/m/<handle>` would resolve to
   * whichever the resolver found first, which is a payment to the wrong shop.
   *
   * A merchant re-claiming its OWN handle is the same row (`existing`) and is
   * allowed, so the idempotent path still works. A different row — even one with
   * the same address — is refused, because two rows cannot share a unique handle.
   */
  const handleHolder = await prisma.merchant.findFirst({ where: { handle } });

  if (handleHolder && handleHolder.id !== existing?.id) {
    const holderAddress = handleHolder.payoutAddress ? getAddress(handleHolder.payoutAddress) : null;

    throw new MerchantClaimError(
      'handle-taken',
      409,
      `The link seti.live/m/${handle} is already taken by "${handleHolder.name}" ` +
        `(${holderAddress ?? 'a merchant with no address'}). Names that reduce to the same ` +
        'link cannot both be claimed — the link would be ambiguous about who is paid. ' +
        'Choose a name whose link is free.'
    );
  }

  const claim = {
    name,
    nameKey,
    handle,
    payoutAddress: claimedAddress,
    claimSignature: input.signature,
    claimIssuedAt: input.issuedAt,
    claimNonce: input.nonce,
    claimedAt: new Date(),
    claimedByUserId: input.userId,
  };

  try {
    return existing
      ? await prisma.merchant.update({ where: { id: existing.id }, data: claim })
      : await prisma.merchant.create({ data: claim });
  } catch (error) {
    // The unique indexes are the concurrency guard: two claims racing for one
    // name — or for one handle — both pass the reads above, and exactly one write
    // wins. Which refusal to return is decided by WHICH index rejected the row.
    if (isUniqueViolation(error)) {
      if (uniqueViolationTarget(error)?.includes('handle')) {
        throw new MerchantClaimError(
          'handle-taken',
          409,
          `The link seti.live/m/${handle} was taken while this request was in flight. Choose another name.`
        );
      }

      throw new MerchantClaimError(
        'name-taken',
        409,
        `"${name}" was claimed by another address while this request was in flight. Choose another name.`
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Handle availability — the claim path's own rule and lookup, for the preview.
// ---------------------------------------------------------------------------

/** Whether a name's link is usable and free, for a merchant still typing it. */
export interface MerchantHandleStatus {
  /** The name as the rule would store it. */
  name: string;
  /** The link's handle for that name — `seti.live/m/<handle>`. */
  handle: string;
  /** A name- or handle-rule failure, or null when the name is usable. */
  problem: string | null;
  /**
   * The merchant already holding this handle, or null when it is free. Only its
   * NAME is surfaced — enough to tell the person the link is taken, and no more
   * than a claim refusal would already name.
   */
  takenBy: string | null;
}

/**
 * The claim path's validation and uniqueness, exposed for the claim form's live
 * preview.
 *
 * It calls the SAME `describeMerchantName` / `describeMerchantHandle` /
 * `merchantHandle` / `handle` lookup the claim does, so the form can never tell a
 * merchant a link is free that the claim would then refuse. It is behind the
 * same auth as the claim (see `routes/merchants.ts`): a signed-in merchant is
 * checking a name it is about to sign for, not enumerating names anonymously.
 */
export async function merchantHandleStatus(rawName: string): Promise<MerchantHandleStatus> {
  const name = normalizeMerchantName(rawName);
  const handle = merchantHandle(rawName);
  const problem = describeMerchantName(rawName) ?? describeMerchantHandle(rawName);

  if (problem) return { name, handle, problem, takenBy: null };

  const holder = await prisma.merchant.findFirst({
    where: { handle },
    select: { name: true },
  });

  return { name, handle, problem: null, takenBy: holder?.name ?? null };
}
