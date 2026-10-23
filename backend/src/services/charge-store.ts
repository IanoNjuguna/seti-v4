/**
 * Where a charge is KEPT — the database half of the charge path.
 *
 * `services/charge.ts` decides what a charge IS and whether it is paid; this file
 * is the only place a charge row is written. Everything that moves a charge's
 * status goes through {@link applyChargeTransition}, and that function is also
 * where the webhook is enqueued — so there is no way to change a status and skip
 * the notification, and no second definition of "the charge is now paid".
 *
 * ## Three rules this file exists to hold
 *
 * 1. **The signature is re-verified from the stored bytes on every read.** There is
 *    no `verified` column to go stale or to be flipped by a database write. A row
 *    whose signature no longer holds is not rendered as a charge at all
 *    ({@link loadChargeView} refuses it), which is the same fail-closed direction
 *    the classifier takes.
 * 2. **A status change is one conditional UPDATE.** `WHERE status = 'pending'` is
 *    the whole concurrency story: two indexer replicas, a replayed transfer and a
 *    racing cancel cannot each move the charge, because only the first UPDATE
 *    matches. Nothing in this product holds funds, so "the money arrived" is a
 *    conclusion the transfer already made — this only records it.
 * 3. **Idempotency returns the response we actually sent.** The created body is
 *    stored on the row, so a replay of the same `Idempotency-Key` returns those
 *    bytes even if the charge has since been paid. Re-deriving the view would
 *    quietly turn "one charge, same answer" into "one charge, a different answer".
 */
import { createHash } from 'node:crypto';
import { getAddress, parseUnits } from 'viem';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { ASSET_DECIMALS } from '../config/assets.js';
import type { Network } from '../lib/network.js';
import {
  CHARGE_SPEC_VERSION,
  chargeIsExpired,
  chargeStatusCopy,
  chargeVerifies,
  type ChargeFields,
  type ChargeStatus,
  type ChargeStatusCopy,
  type SignedCharge,
} from './charge.js';
import { enqueueChargeWebhook } from './charge-webhook.js';
import type { Charge as ChargeRow } from '@prisma/client';

/**
 * What a charge id may look like. MIRRORED in `web/lib/charges/charge.constants.ts`
 * (`CHARGE_ID_PATTERN`).
 *
 * Lower-case only, and that is load-bearing rather than cosmetic: the classifier
 * matches the id into the transfer's memo with a case-SENSITIVE `includes`, so an
 * id minted with capitals could never be matched by a payer who typed what the page
 * showed them. The page refuses a non-lower-case id before any lookup, so an id the
 * API accepted but the page refused would be a link that cannot be opened.
 */
export const CHARGE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{5,63}$/;

/** The QR scheme. Mirrored in the web's `charge.constants.ts`. */
export const CHARGE_URI_PREFIX = 'seti://pay/';

/**
 * How long an `Idempotency-Key` is honoured. After this the key may be reused for a
 * different body — a merchant retrying last week's script must not be stuck with
 * last week's charge.
 */
export const CHARGE_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** The status a charge is created in, spelled once. */
export const CHARGE_INITIAL_STATUS: ChargeStatus = 'pending';

/** The amount placeholder a charge carries until a transfer decides it. */
const ZERO_AMOUNT = '0.000000';

/**
 * The origin a charge's page URL points at when nothing is configured.
 *
 * The production site. A deployment that serves elsewhere sets `SETI_PAGE_ORIGIN`;
 * an unset or blank value must still produce an ABSOLUTE URL, because a relative one
 * in an API response is a link nobody can open from another machine.
 */
export const DEFAULT_CHARGE_PAGE_ORIGIN = 'https://seti.live';

/** The configured page origin, without a trailing slash. */
export function chargePageOrigin(): string {
  const configured = (env.SETI_PAGE_ORIGIN ?? '').trim();
  return (configured || DEFAULT_CHARGE_PAGE_ORIGIN).replace(/\/+$/, '');
}

/**
 * The public page a charge is readable at.
 *
 * Built from `SETI_PAGE_ORIGIN` rather than from the request's `Host`: a charge
 * created by `curl` from a box with no Seti context still has to come back with a
 * URL that opens on the real site, and a `Host` header is client-supplied — the
 * same reason every other absolute link in this product comes from config.
 */
export function chargePageUrl(publicId: string): string {
  return `${chargePageOrigin()}/pay/${publicId}`;
}

/** The `seti://pay/<id>` string a QR encodes. */
export function chargeUri(publicId: string): string {
  return `${CHARGE_URI_PREFIX}${publicId}`;
}

/**
 * The key we store for an `Idempotency-Key` header.
 *
 * Hashed, never stored raw: the key is chosen by the caller and may be anything,
 * and a table that accumulates raw client secrets is a table that leaks them. A
 * SHA-256 is enough for the only question asked of it — "did this recipient send
 * this exact key in the last 24h?" — and it is scoped by the recipient in the
 * unique index, so one merchant's key cannot collide with another's.
 */
export function hashIdempotencyKey(key: string): string {
  return createHash('sha256').update(`charge-idempotency:${key}`).digest('hex');
}

/** A charge as the API hands it to a client, with nothing internal on it. */
export interface ChargeView extends SignedCharge {
  status: ChargeStatus;
  txHash: string | null;
  /** How much actually arrived, in decimal token units. `"0.000000"` while pending. */
  received: string;
  /**
   * Whether the 2% reached `SETI_TREASURY_ADDRESS` in this charge's receipt.
   *
   * `null` until a transfer decides the charge — and for a charge decided before
   * this column existed, where the honest answer is "not recorded" rather than a
   * guess. Deliberately NOT folded into `status`: a payment can be `paid` and its
   * fee uncollected, and those are two facts a surface must be able to tell apart.
   */
  feeCollected: boolean | null;
  /** Why not, when it was not. Null when collected, or when nothing was decided. */
  feeUncollectedReason: string | null;
  /** `testnet` | `mainnet` — the network the signature was made under. */
  network: string;
  chainId: number;
  createdAt: string;
  updatedAt: string;
  /** When the transfer decided it. Null while pending. */
  settledAt: string | null;
  /** When the recipient cancelled it. Null unless they did. */
  cancelledAt: string | null;
  /** The payload a wallet scans. */
  uri: string;
  /** The URL a human opens. Absolute, from `SETI_PAGE_ORIGIN`. */
  pageUrl: string;
  /** The wording for this status — the API sends the product's words. */
  statusCopy: ChargeStatusCopy;
  /** The version of the charge contract this row was written under. */
  specVersion: string;
}

/** The row, as the object every surface renders. */
export function toChargeView(row: ChargeRow): ChargeView {
  return {
    id: row.publicId,
    recipient: row.recipient as `0x${string}`,
    asset: row.asset as ChargeFields['asset'],
    amount: row.amount,
    memo: row.memo,
    expiresAt: row.expiresAtRaw,
    nonce: row.nonce,
    scope: row.scope,
    signature: row.signature,
    status: row.status,
    txHash: row.txHash,
    received: row.received,
    feeCollected: row.feeCollected ?? null,
    feeUncollectedReason: row.feeUncollectedReason ?? null,
    network: row.network,
    chainId: row.chainId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    settledAt: row.settledAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    uri: chargeUri(row.publicId),
    pageUrl: chargePageUrl(row.publicId),
    statusCopy: chargeStatusCopy(row.status),
    specVersion: CHARGE_SPEC_VERSION,
  };
}

/** The stored row as the pure object, for the classifier and for verification. */
export function toSignedCharge(row: ChargeRow): SignedCharge & { status: ChargeStatus } {
  return {
    id: row.publicId,
    recipient: row.recipient as `0x${string}`,
    asset: row.asset as ChargeFields['asset'],
    amount: row.amount,
    memo: row.memo,
    expiresAt: row.expiresAtRaw,
    nonce: row.nonce,
    scope: row.scope,
    signature: row.signature,
    status: row.status,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** A charge by its public id, or null. No recipient scope: an id is globally unique
 *  in practice, and a link carries only the id. */
export async function findCharge(publicId: string): Promise<ChargeRow | null> {
  return prisma.charge.findFirst({ where: { publicId } });
}

export type LoadedCharge =
  | { kind: 'charge'; row: ChargeRow }
  | { kind: 'not-found' }
  /** A stored charge whose signature no longer holds, or whose expiry cannot be read. */
  | { kind: 'invalid' };

/**
 * Read one charge for a surface, re-verifying the signature from the stored bytes.
 *
 * A charge that does not verify is `invalid` — never `not-found`, because the two
 * are different statements: "there is nothing here" is untrue about a request that
 * exists, and the payer must be told not to pay it rather than that the link is
 * dead. The page's `PayRefusal` renders exactly that distinction.
 */
export async function loadChargeView(publicId: string): Promise<LoadedCharge> {
  if (!CHARGE_ID_PATTERN.test(publicId)) return { kind: 'not-found' };

  const row = await findCharge(publicId);
  if (!row) return { kind: 'not-found' };

  if (!(await chargeVerifies(toSignedCharge(row), row.chainId))) return { kind: 'invalid' };

  return { kind: 'charge', row };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateChargeInput {
  /** The charge as the recipient signed it. Already schema-shaped; verified here. */
  charge: SignedCharge;
  network: Network;
  chainId: number;
  webhookUrl: string | null;
  /** The raw `Idempotency-Key` header, if one was sent. Hashed before storage. */
  idempotencyKey: string | null;
  now?: Date;
}

export type CreateChargeResult =
  | { kind: 'created'; view: ChargeView; body: string }
  /** A replay of the same key: the ORIGINAL response body, exactly as it was sent. */
  | { kind: 'replayed'; body: string }
  /** The same key, a different charge. A client bug worth a 409, not a silent overwrite. */
  | { kind: 'idempotency-key-reused' }
  /** This recipient already has a charge with this id, and it is not this one. */
  | { kind: 'id-taken' };

/** What a live `Idempotency-Key` already means, if anything. */
export type IdempotentReplay =
  /** No live row holds this key: this is a new request. */
  | { kind: 'none' }
  /** The SAME request was already answered: reply with that body. */
  | { kind: 'replay'; body: string }
  /** The key is live and belongs to a DIFFERENT charge. */
  | { kind: 'reused' };

/**
 * Did this recipient already use this key for a live charge?
 *
 * Exported because the ROUTE asks it before it validates anything else: a replay has to
 * come back with the original body even if the charge has since passed its own deadline
 * (a client retrying an hour later must not be told "charge-expired" — the charge it
 * created is a real one and it is still the same request). The route only needs the
 * recipient, the key, the signature and the webhook URL; nothing else about the body is
 * believed until the signature has been checked.
 *
 * "The same request" is decided by the SIGNATURE: EIP-712 covers every signed field, so
 * an equal signature is an equal charge. The webhook URL is outside the signature, so it
 * is compared separately.
 */
export async function findIdempotentReplay(input: {
  recipient: string;
  idempotencyKey: string | null;
  signature: string;
  webhookUrl: string | null;
  now?: Date;
}): Promise<IdempotentReplay> {
  if (!input.idempotencyKey) return { kind: 'none' };

  const now = input.now ?? new Date();
  const keyHash = hashIdempotencyKey(input.idempotencyKey);

  const existing = await prisma.charge.findFirst({
    where: { recipient: input.recipient.toLowerCase(), idempotencyKey: keyHash },
  });

  if (!existing) return { kind: 'none' };

  const fresh = now.getTime() - (existing.idempotencyAt?.getTime() ?? 0) < CHARGE_IDEMPOTENCY_TTL_MS;
  if (!fresh) return { kind: 'none' };

  if (existing.signature === input.signature && existing.webhookUrl === input.webhookUrl) {
    return {
      kind: 'replay',
      body: existing.responseBody ?? JSON.stringify({ charge: toChargeView(existing) }),
    };
  }

  return { kind: 'reused' };
}

/**
 * Write one charge, honouring an `Idempotency-Key` for 24 hours.
 *
 * The order is: find a live key first (a replay must not even look at the body's
 * uniqueness), release a key that has outlived its window, then insert, then translate
 * the unique-constraint violation into the answer the caller can act on. Both races the
 * schema can see — the same key twice, the same id twice — land on a real row rather
 * than on a 500.
 */
export async function createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
  const now = input.now ?? new Date();
  const recipient = input.charge.recipient.toLowerCase();
  const keyHash = input.idempotencyKey ? hashIdempotencyKey(input.idempotencyKey) : null;

  const replay = await findIdempotentReplay({
    recipient,
    idempotencyKey: input.idempotencyKey,
    signature: input.charge.signature,
    webhookUrl: input.webhookUrl,
    now,
  });

  if (replay.kind === 'replay') return { kind: 'replayed', body: replay.body };
  if (replay.kind === 'reused') return { kind: 'idempotency-key-reused' };

  // Past the window: free the key so this charge can be created under it. The old charge
  // is untouched — it is a real charge, only its key is released.
  if (keyHash) {
    await prisma.charge.updateMany({
      where: {
        recipient,
        idempotencyKey: keyHash,
        idempotencyAt: { lt: new Date(now.getTime() - CHARGE_IDEMPOTENCY_TTL_MS) },
      },
      data: { idempotencyKey: null },
    });
  }

  const expiresAt = new Date(input.charge.expiresAt);

  try {
    const row = await prisma.charge.create({
      data: {
        publicId: input.charge.id,
        recipient,
        asset: input.charge.asset,
        amount: input.charge.amount,
        memo: input.charge.memo,
        expiresAtRaw: input.charge.expiresAt,
        expiresAt,
        nonce: input.charge.nonce,
        scope: input.charge.scope,
        signature: input.charge.signature,
        status: CHARGE_INITIAL_STATUS,
        network: input.network,
        chainId: input.chainId,
        received: ZERO_AMOUNT,
        webhookUrl: input.webhookUrl,
        idempotencyKey: keyHash,
        idempotencyAt: keyHash ? now : null,
      },
    });

    const view = toChargeView(row);
    const body = JSON.stringify({ charge: view });

    // The response is stored so a replay can return THESE BYTES — and the SAME string
    // is what the 201 sends, because the update below moves `updatedAt` and a view
    // re-read afterwards would differ from the body that was stored. A charge created
    // without a key stores nothing, which is why the response is built here for both.
    if (keyHash) {
      await prisma.charge.update({ where: { id: row.id }, data: { responseBody: body } });
    }

    return { kind: 'created', view, body };
  } catch (error) {
    if (isUniqueViolation(error, 'charges_recipient_idempotencyKey_key')) {
      // Two creates with the same key raced. The winner's row is the answer.
      const winner = keyHash
        ? await prisma.charge.findFirst({ where: { recipient, idempotencyKey: keyHash } })
        : null;
      if (winner) {
        return {
          kind: 'replayed',
          body: winner.responseBody ?? JSON.stringify({ charge: toChargeView(winner) }),
        };
      }
    }

    if (isUniqueViolation(error, 'charges_recipient_publicId_key')) {
      return { kind: 'id-taken' };
    }

    throw error;
  }
}

/** True when this is Prisma's unique-constraint violation on `constraint`. */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  const code = (error as { code?: string }).code;
  if (code !== 'P2002') return false;
  const target = (error as { meta?: { target?: string | string[] } }).meta?.target;
  const fields = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return fields.includes(constraint) || fields.includes('publicId') || fields.includes('idempotencyKey');
}

// ---------------------------------------------------------------------------
// Transitions — the ONLY way a status moves
// ---------------------------------------------------------------------------

export interface TransitionInput {
  row: ChargeRow;
  to: ChargeStatus;
  /** The transfer that decided it. */
  txHash?: string | null;
  /** How much the transfer moved, decimal token units. */
  received?: string;
  /**
   * The fee fact, when a decision produced one.
   *
   * Written on the same conditional UPDATE as the status, so a charge can never be
   * `paid` with a fee verdict from a different transfer. Omitted by a transition
   * that decided no money at all (an expiry), which leaves both columns alone.
   */
  fee?: { collected: boolean; reason: string | null };
  /** Set only by a recipient's cancel. */
  cancelledAt?: Date | null;
  now?: Date;
}

/**
 * Move a charge to a new status, at most once, and enqueue the webhook for it.
 *
 * Returns the updated row, or `null` when the charge had already left `pending` and
 * something else got there first — which is an ordinary outcome, not an error: it is
 * what a replayed transfer, a second indexer replica or a racing cancel produces.
 *
 * The webhook is enqueued HERE and nowhere else, and the delivery table's unique
 * `(chargeId, status)` makes the second enqueue a no-op, so "exactly one delivery
 * per status change" holds even if this function is called twice for the same move.
 */
export async function applyChargeTransition(input: TransitionInput): Promise<ChargeRow | null> {
  const now = input.now ?? new Date();

  const { count } = await prisma.charge.updateMany({
    where: { id: input.row.id, status: CHARGE_INITIAL_STATUS },
    data: {
      status: input.to,
      txHash: input.txHash ?? null,
      received: input.received ?? input.row.received,
      settledAt: input.to === CHARGE_INITIAL_STATUS ? null : now,
      ...(input.fee
        ? {
            feeCollected: input.fee.collected,
            feeUncollectedReason: input.fee.reason,
          }
        : {}),
      ...(input.cancelledAt ? { cancelledAt: input.cancelledAt } : {}),
    },
  });

  if (count === 0) return null;

  const updated = await prisma.charge.findUnique({ where: { id: input.row.id } });
  if (!updated) return null;

  await enqueueChargeWebhook(updated, toChargeView(updated), now);

  return updated;
}

/**
 * Expire a charge whose deadline has passed, if it is still pending.
 *
 * Called from a read (so the answer is right without an indexer running) and from
 * the periodic sweep (so a webhook is still fired for a charge nobody reads).
 * Idempotent: the conditional UPDATE in {@link applyChargeTransition} is what makes
 * two callers safe.
 */
export async function expireChargeIfDue(row: ChargeRow, now: Date = new Date()): Promise<ChargeRow | null> {
  if (row.status !== CHARGE_INITIAL_STATUS) return null;
  if (!chargeIsExpired({ ...toSignedCharge(row) }, now)) return null;

  return applyChargeTransition({ row, to: 'expired', now });
}

/** Every pending charge whose deadline has passed, oldest deadline first. */
export async function findDueExpiries(limit: number, now: Date = new Date()): Promise<ChargeRow[]> {
  return prisma.charge.findMany({
    where: { status: CHARGE_INITIAL_STATUS, expiresAt: { lte: now } },
    orderBy: { expiresAt: 'asc' },
    take: limit,
  });
}

/**
 * Pending charges a transfer could settle.
 *
 * The match is narrowed in SQL by recipient and asset before the classifier is
 * asked, because those two facts are cheap, exact and indexed. What is NOT decided
 * here is whether the charge is paid: that is `classifyCharge`'s answer alone, and
 * duplicating any part of it here is how two definitions of `paid` appear.
 */
export async function findPendingCharges(input: {
  network: Network;
  recipients: string[];
  asset: string;
}): Promise<ChargeRow[]> {
  if (input.recipients.length === 0) return [];

  return prisma.charge.findMany({
    where: {
      status: CHARGE_INITIAL_STATUS,
      network: input.network,
      asset: input.asset,
      recipient: { in: input.recipients },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * The DISTINCT recipients with a pending charge on this network, capped.
 *
 * The indexer asks the RPC for memos sent TO these addresses, so the query stays
 * narrow — one address list, not every transfer on the chain. Distinct in SQL because
 * a merchant with fifty live links is one address to filter on, not fifty.
 */
export async function distinctPendingRecipients(
  network: Network,
  limit: number
): Promise<string[]> {
  const rows = await prisma.charge.findMany({
    where: { status: CHARGE_INITIAL_STATUS, network },
    distinct: ['recipient'],
    select: { recipient: true },
    orderBy: { recipient: 'asc' },
    take: limit,
  });

  return rows.map((row) => row.recipient);
}

/** Parse a decimal token amount into base units, or null when it is not one. */
export function chargeAmountUnits(amount: string): bigint | null {
  try {
    const units = parseUnits(amount.trim(), ASSET_DECIMALS);
    return units >= 0n ? units : null;
  } catch {
    return null;
  }
}

/**
 * Base units back to a FIXED 6-decimal string (`100000000n` → `"100.000000"`).
 *
 * viem's `formatUnits` writes `"100"`, which is a valid decimal but not the shape the
 * column and the API promise — and a charge's `received` is compared with its `amount`
 * by eye in a support tool, so the two must look alike. Integers, never floats.
 */
export function unitsToAmount(units: bigint): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const scale = BigInt(10) ** BigInt(ASSET_DECIMALS);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(ASSET_DECIMALS, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** A usable EVM address, or null. Used to lowercase a body's recipient safely. */
export function normaliseAddress(address: string): string | null {
  try {
    return getAddress(address).toLowerCase();
  } catch {
    return null;
  }
}
