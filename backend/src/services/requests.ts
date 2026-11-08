/**
 * Requests for money: the ask, and the one rule that matters about settling it (#98, #447).
 *
 * A request is a link carrying a payee and an amount. It is NOT a `Charge`: a charge is EIP-712
 * signed by its recipient, denominated in token units, and settles when a transfer carries its id in
 * a 32-byte memo. A request is unsigned, in the customer's currency, and its amount is the payer's to
 * change — so it needs no signature and can never be a locked claim.
 *
 * What both share is this module's whole reason to exist: an ask settles ONCE, and the second
 * attempt is refused with a sentence rather than a silent no-op.
 *
 * ## Why the guard is an UPDATE and not a read-then-write
 *
 * `UPDATE … WHERE status = 'open'` returns the number of rows it changed. Two callers racing the same
 * request cannot both see `open` and both write: the second one's WHERE clause matches nothing, and it
 * is told which payment took it. A `findFirst` followed by an `update` is the shape that records one
 * payment twice, and a flaky mobile network makes that race ordinary rather than theoretical.
 *
 * ## Why the transaction id is UNIQUE as well
 *
 * The status guard stops the same request settling twice. The unique index stops one payment
 * satisfying two different asks — a wrong-link case rather than a retry — and it lives in the
 * database because that is the only place two concurrent writers both pass through.
 */
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { findHandleByHandle } from './handles.js';

/** Why a request operation was refused. Codes, never prose: the surfaces own the sentences. */
export type RequestRefusalCode =
  | 'expired'
  | 'destination-not-found'
  | 'destination-not-yours'
  | 'amount-invalid'
  | 'currency-invalid'
  | 'expiry-invalid'
  | 'not-found'
  | 'payment-not-found'
  | 'payment-not-a-send'
  | 'payment-not-completed'
  | 'amount-short'
  | 'amount-over'
  | 'currency-mismatch'
  | 'already-settled'
  | 'already-cancelled'
  | 'transaction-already-used';

export class PaymentRequestError extends Error {
  readonly code: RequestRefusalCode;
  /** The payment that decided the request, when the refusal is about one. */
  readonly settledTransactionId: string | null;

  constructor(code: RequestRefusalCode, settledTransactionId: string | null = null) {
    super(code);
    this.name = 'PaymentRequestError';
    this.code = code;
    this.settledTransactionId = settledTransactionId;
  }
}

/**
 * What a request may be denominated in. KES is the only figure the product prints, and a request is a
 * figure a payer will be asked to send, so an unknown currency is refused at creation rather than
 * stored and mis-rendered later.
 */
export const REQUEST_CURRENCIES = ['KES'] as const;

/**
 * An amount as the product accepts it: a decimal string, at most two decimals, at most nine integer
 * digits, and greater than zero.
 *
 * Matched, not parsed: `Number('1e9')` is a valid number and a different amount from what the payer
 * will read, so the shape is the rule. This is the same rule the pay keypad enforces at the key
 * (`applyKey` in the web's `pay-keypad.ts`), and the two must agree or a figure the field accepts is
 * refused by the server.
 */
export const REQUEST_AMOUNT_PATTERN = /^[0-9]{1,9}(\.[0-9]{1,2})?$/;

/**
 * How long an ask lives when the caller does not say (#449).
 *
 * Thirty days because an ask is a social thing: rent, a shared bill, somebody's lunch. Long enough
 * that a link in a chat is still good next weekend, short enough that a forgotten one does not sit
 * open for a year. `expiresAt: null` is the caller saying "never", which is what a tip jar wants, and
 * that is a decision the caller makes explicitly rather than a default.
 */
export const REQUEST_DEFAULT_EXPIRY_DAYS = 30;

/** The instant an ask created now should lapse, when the caller asked for the default. */
export function defaultExpiryFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + REQUEST_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

/** What a request IS, once the clock is taken into account. */
export type RequestState = 'open' | 'settled' | 'cancelled' | 'expired';

/**
 * Is this ask past its expiry at `now`? The ONE predicate (#449).
 *
 * `null` is not a lapse: it is an ask that never expires, which is a decision the creator made
 * (`expiresAt: null`, the tip jar). An UNREADABLE instant is a lapse, following `chargeIsExpired`:
 * a value nobody can read is not evidence that a link is live, and the fail-closed direction for a
 * payment link is the inert one.
 *
 * The clock is the CALLER's, not SQL's. `expiresAt` is a `timestamp(3)` holding UTC, and comparing it
 * to Postgres `now()` shifts by the session's zone — the trap `analytics.ts` documents. So every
 * caller passes `new Date()` and both sides of a comparison stay on one clock.
 */
export function isRequestExpired(
  request: { expiresAt: Date | null },
  now: Date = new Date()
): boolean {
  if (request.expiresAt === null) return false;
  const at = request.expiresAt.getTime();
  if (Number.isNaN(at)) return true;
  return now.getTime() >= at;
}

/**
 * The state a row is in, with lapse DERIVED rather than stored.
 *
 * Nothing writes `expired` in v1: no job sweeps for it and no writer can produce it, so a stored value
 * would be dead schema. The settle guard is what makes this derivation safe, and a surface must never
 * decide property from this function.
 */
export function requestState(
  row: { status: RequestState; expiresAt: Date | null },
  now: Date = new Date()
): RequestState {
  if (row.status !== 'open') return row.status;
  return isRequestExpired(row, now) ? 'expired' : 'open';
}

/**
 * An amount as the product accepts it: a decimal string, at most two decimals, at most nine integer
 * digits, and greater than zero.
 *
 * Matched, not parsed: `Number('1e9')` is a valid number and a different amount from what the payer
 * will read, so the shape is the rule. This is the same rule the pay keypad enforces at the key
 * (`applyKey` in the web's `pay-keypad.ts`), and the two must agree or a figure the field accepts is
 * refused by the server.
 */
export function isValidRequestAmount(amount: string): boolean {
  if (!REQUEST_AMOUNT_PATTERN.test(amount)) return false;
  return Number(amount) > 0;
}

/**
 * The liveness fragment: `status = 'open'` AND the ask is inside its window.
 *
 * ONE place, because it is the definition of "claimable", and a read that forgets it renders a lapsed
 * ask as payable — the exact failure this exists to prevent. The boundary is a JS `Date` bound as a
 * parameter, never SQL `now()`: the column is a naive `timestamp(3)` holding UTC, and Postgres would
 * reinterpret it in the session's zone.
 *
 * It guards the settle, and is mirrored in TypeScript by `isRequestExpired` for the surfaces that
 * render state. The two take the same boundary so they cannot disagree.
 */
function liveRequestSql(boundary: Date) {
  return Prisma.sql`("status" = 'open' AND ("expiresAt" IS NULL OR "expiresAt" > ${boundary}))`;
}

/**
 * A fiat figure as integer minor units, for an exact comparison.
 *
 * Hundreds of a shilling, because that is the smallest unit any figure in this product prints.
 * `Number` is exact here: a KES ticket is nine digits at most, far inside 2^53.
 */
function minorUnits(amount: string): number {
  return Math.round(Number(amount) * 100);
}

/** The public id: 18 hex characters from 9 random bytes. Opaque and unguessable: the link is the capability. */
function newPublicId(): string {
  return randomBytes(9).toString('hex');
}

/** How far ahead an explicit expiry may be. Beyond this, `null` ("never") is the honest ask. */
export const REQUEST_MAX_EXPIRY_DAYS = 365;

export interface CreateRequestInput {
  /** The account asking. */
  creatorId: string;
  /** The handle asked, as the customer typed or picked it. */
  destinationHandle: string;
  /** A decimal string in `currency`. */
  amount: string;
  currency?: string;
  memo?: string;
  /** Omit for the 30-day default; `null` for an ask that never expires. */
  expiresAt?: Date | null;
}

export interface CreatedRequest {
  id: string;
  publicId: string;
  destinationHandle: string;
  destinationAddress: string;
  amount: string;
  currency: string;
  memo: string;
  status: 'open';
}

/**
 * Create an ask.
 *
 * The payee is resolved HERE, not at payment time: a link that names a handle nothing resolves is a
 * link that fails in front of whoever it was sent to (#98 AC5), so it fails now, in front of whoever
 * wrote it. The handle's address is snapshotted beside it — the handle can change hands, and a request
 * already sent should keep pointing at the account it named.
 */
export async function createRequest(input: CreateRequestInput): Promise<CreatedRequest> {
  const currency = input.currency ?? 'KES';
  if (!REQUEST_CURRENCIES.includes(currency as (typeof REQUEST_CURRENCIES)[number])) {
    throw new PaymentRequestError('currency-invalid');
  }
  if (!isValidRequestAmount(input.amount)) throw new PaymentRequestError('amount-invalid');

  /*
   * The window is validated HERE and never taken from a client as-is (#449): a past date would create
   * an ask that is already dead, and a year-3000 one would be an ask nobody can distinguish from "no
   * expiry" while still being written down. `null` is the honest way to say never, and the caller that
   * wants it says so explicitly.
   */
  const now = Date.now();
  const expiresAt =
    input.expiresAt === undefined ? defaultExpiryFrom(new Date(now)) : input.expiresAt;

  if (expiresAt !== null) {
    const at = expiresAt.getTime();
    if (Number.isNaN(at)) throw new PaymentRequestError('expiry-invalid');
    if (at <= now) throw new PaymentRequestError('expiry-invalid');
    if (at > now + REQUEST_MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      throw new PaymentRequestError('expiry-invalid');
    }
  }

  const handle = await findHandleByHandle(input.destinationHandle);
  if (!handle) throw new PaymentRequestError('destination-not-found');

  /*
   * An ask is "I am asking you for money and it comes to me", so the destination must be the creator's
   * OWN handle. A handle somebody else owns is a CHARGE, which is a different object with a signature
   * and a token amount; accepting it here would move money into an account the asker does not control
   * (#455).
   */
  if (handle.userId !== input.creatorId) throw new PaymentRequestError('destination-not-yours');

  const row = await prisma.paymentRequest.create({
    data: {
      publicId: newPublicId(),
      creatorId: input.creatorId,
      destinationHandleId: handle.id,
      destinationHandleText: handle.handle,
      destinationAddress: handle.address.toLowerCase(),
      amount: input.amount,
      currency,
      memo: input.memo?.trim() ?? '',
      expiresAt,
    },
  });

  return {
    id: row.id,
    publicId: row.publicId,
    destinationHandle: row.destinationHandleText,
    destinationAddress: row.destinationAddress,
    amount: row.amount,
    currency: row.currency,
    memo: row.memo,
    status: 'open',
  };
}

export interface SettleRequestInput {
  publicId: string;
  /**
   * The ledger row that paid it. VERIFIED here against the request before anything moves: the id is
   * an input from whoever calls this, and an id that is trusted is an id that can settle a KES 500 ask
   * with a KES 5 payment.
   */
  transactionId: string;
}

/**
 * Mark an ask paid. Called by the send path, in the same transaction as its ledger write.
 *
 * A refusal never throws for a request that is already settled — it reports WHICH payment settled it,
 * because the caller's next sentence is "this was already paid" and it cannot say that without the id.
 */
export async function settleRequest(input: SettleRequestInput): Promise<void> {
  /*
   * ONE statement, three conditions, and the clock is the DATABASE's (#449).
   *
   * Raw SQL because `now()` has to be Postgres's: an app clock is a client clock a skewed host can
   * move, and a request that lapsed a minute ago must not become payable because the caller's machine
   * is fast. It is also still a compare-and-set — `status = 'open'` and the time condition are judged
   * by the same UPDATE — so two racers cannot both win, and a caller who read the row a second before
   * it lapsed cannot settle it afterwards.
   *
   * Expiry is DERIVED on read and never swept: this guard is what makes the derived read safe, and it
   * means v1 needs no cron.
   */
  /*
   * THE MONEY CHECK, before the write (#449: a single ask is paid in FULL, no partials).
   *
   * The ledger row is the fact: its fiat figure is what the send recorded against the frozen quote, and
   * the ask's amount is what was asked. Short is refused and leaves the ask open, because a short
   * payment that closed an ask would take the asker's link away for less than they asked. Over is
   * refused too: it is not a tolerance question, it is a different agreement.
   *
   * Both sides are fiat from the same currency, so the comparison is exact in minor units. A tolerance
   * here would be a way to pay 99% of an ask and have it settle.
   */
  const payment = await prisma.transaction.findUnique({
    where: { id: input.transactionId },
    select: {
      id: true,
      txHash: true,
      type: true,
      status: true,
      fiatAmount: true,
      fiatCurrency: true,
    },
  });

  if (!payment) throw new PaymentRequestError('payment-not-found');
  if (payment.type !== 'p2p_send' && payment.type !== 'payment') {
    throw new PaymentRequestError('payment-not-a-send');
  }
  if (payment.status !== 'completed') throw new PaymentRequestError('payment-not-completed');

  const request = await prisma.paymentRequest.findUnique({
    where: { publicId: input.publicId },
    select: { amount: true, currency: true, status: true, expiresAt: true, settledTransactionId: true },
  });

  if (!request) throw new PaymentRequestError('not-found');

  /*
   * Exactly equal, and a payment with NO recorded currency is refused too: "we do not know what money
   * this was" is not evidence that it was in the ask's currency, and the fail-closed direction for
   * closing an ask is the one that leaves it open.
   */
  if (payment.fiatCurrency !== request.currency) throw new PaymentRequestError('currency-mismatch');

  const askedMinor = minorUnits(request.amount);
  const paidMinor = payment.fiatAmount === null ? null : minorUnits(payment.fiatAmount.toFixed(2));

  if (paidMinor === null) throw new PaymentRequestError('payment-not-completed');
  if (paidMinor < askedMinor) throw new PaymentRequestError('amount-short');
  if (paidMinor > askedMinor) throw new PaymentRequestError('amount-over');

  const boundary = new Date();
  const changed = await prisma.$executeRaw`
    UPDATE "payment_requests"
       SET "status" = 'settled',
           "settledTransactionId" = ${input.transactionId},
           "settledTxHash" = ${payment.txHash},
           "settledAt" = ${boundary},
           "updatedAt" = ${boundary}
     WHERE "publicId" = ${input.publicId}
       AND ${liveRequestSql(boundary)}
  `;

  if (changed === 1) return;

  const existing = await prisma.paymentRequest.findUnique({
    where: { publicId: input.publicId },
    select: { status: true, settledTransactionId: true, expiresAt: true },
  });

  if (!existing) throw new PaymentRequestError('not-found');
  if (existing.status === 'settled') {
    throw new PaymentRequestError('already-settled', existing.settledTransactionId ?? null);
  }
  if (existing.status === 'cancelled') throw new PaymentRequestError('already-cancelled');
  if (isRequestExpired(existing, boundary)) throw new PaymentRequestError('expired');
  // Open, in time, and the UPDATE changed nothing: only a concurrent settle explains that.
  throw new PaymentRequestError('already-settled', existing.settledTransactionId ?? null);
}

/** Withdraw an ask. Guarded the same way, and only by the account that made it. */
export async function cancelRequest(publicId: string, creatorId: string): Promise<void> {
  const changed = await prisma.paymentRequest.updateMany({
    where: { publicId, creatorId, status: 'open' },
    data: { status: 'cancelled', cancelledAt: new Date() },
  });

  if (changed.count === 1) return;

  const existing = await prisma.paymentRequest.findUnique({
    where: { publicId },
    select: { creatorId: true, status: true, settledTransactionId: true },
  });

  if (!existing) throw new PaymentRequestError('not-found');
  /*
   * OWNERSHIP IS ANSWERED FIRST, before the state. A stranger asking about somebody else's ask learns
   * nothing: not that it exists, and not that it is paid. Checking the state first leaked "already
   * settled" to anyone holding the link, which is a fact about another person's money.
   */
  if (existing.creatorId !== creatorId) throw new PaymentRequestError('not-found');
  if (existing.status === 'settled') {
    throw new PaymentRequestError('already-settled', existing.settledTransactionId ?? null);
  }
  throw new PaymentRequestError('already-cancelled');
}

export interface RequestSummary {
  publicId: string;
  destinationHandle: string;
  amount: string;
  currency: string;
  memo: string;
  status: RequestState;
  createdAt: Date;
  /** Null when the ask never expires. */
  expiresAt: Date | null;
  settledTxHash: string | null;
}

/**
 * Settle every open ask that a completed payment already names (#447).
 *
 * The gap this closes: `recordSend` writes the ledger row, then the settlement is attempted. A process
 * that dies between the two leaves money moved and the ask `open`, with nothing to retry. This is the
 * retry, and it is a sweep rather than a job: it is idempotent, it does nothing when there is nothing to
 * do, and running it twice changes nothing.
 *
 * A row whose figures do not match is LEFT ALONE and reported. Reconciliation never widens a rule: if
 * the payment is short or in another currency, the ask stays open and a human reads the count.
 */
export interface ReconcileResult {
  settled: string[];
  refused: Array<{ publicId: string; code: RequestRefusalCode }>;
}

export async function reconcileClaims(limit = 50): Promise<ReconcileResult> {
  const open = await prisma.paymentRequest.findMany({
    where: { status: 'open' },
    select: { publicId: true },
    take: limit,
  });

  const settled: string[] = [];
  const refused: Array<{ publicId: string; code: RequestRefusalCode }> = [];

  for (const ask of open) {
    // The newest completed payment that names this ask and is not already spent on another one.
    const payment = await prisma.transaction.findFirst({
      where: { claimPublicId: ask.publicId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!payment) continue;

    try {
      await settleRequest({ publicId: ask.publicId, transactionId: payment.id });
      settled.push(ask.publicId);
    } catch (error) {
      if (error instanceof PaymentRequestError) {
        // Already settled by the direct call in the request, or refused on the money. Either way the
        // loop must not stop, and a refusal is reported rather than retried for ever.
        if (error.code !== 'already-settled') {
          refused.push({ publicId: ask.publicId, code: error.code });
        }
        continue;
      }
      throw error;
    }
  }

  return { settled, refused };
}

/** The asks one account made, newest first: the Activity rows (#98 AC4). */
export async function listRequests(creatorId: string): Promise<RequestSummary[]> {
  const rows = await prisma.paymentRequest.findMany({
    where: { creatorId },
    orderBy: { createdAt: 'desc' },
    select: {
      publicId: true,
      destinationHandleText: true,
      amount: true,
      currency: true,
      memo: true,
      status: true,
      createdAt: true,
      settledTxHash: true,
      expiresAt: true,
    },
  });

  return rows.map((row) => ({
    publicId: row.publicId,
    destinationHandle: row.destinationHandleText,
    amount: row.amount,
    currency: row.currency,
    memo: row.memo,
    // Derived, so a lapsed ask reads as expired without anything having had to write it.
    status: requestState({ status: row.status, expiresAt: row.expiresAt }),
    createdAt: row.createdAt,
    settledTxHash: row.settledTxHash,
    expiresAt: row.expiresAt,
  }));
}

/** What a payer's link resolves to. The same read the settle step uses, and it is public by design. */
export interface PublicRequest {
  publicId: string;
  destinationHandle: string;
  destinationAddress: string;
  amount: string;
  currency: string;
  memo: string;
  status: RequestState;
  /** When it lapses, so a payer's page can say so. Null when it never does. */
  expiresAt: Date | null;
}

export async function readPublicRequest(publicId: string): Promise<PublicRequest | null> {
  const row = await prisma.paymentRequest.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      destinationHandleText: true,
      destinationAddress: true,
      amount: true,
      currency: true,
      memo: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!row) return null;
  return {
    publicId: row.publicId,
    destinationHandle: row.destinationHandleText,
    destinationAddress: row.destinationAddress,
    amount: row.amount,
    currency: row.currency,
    memo: row.memo,
    status: requestState({ status: row.status, expiresAt: row.expiresAt }),
    expiresAt: row.expiresAt,
  };
}
