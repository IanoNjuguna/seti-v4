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
import { prisma } from '../lib/prisma.js';
import { findHandleByHandle } from './handles.js';

/** Why a request operation was refused. Codes, never prose: the surfaces own the sentences. */
export type RequestRefusalCode =
  | 'payee-not-found'
  | 'payee-is-you'
  | 'amount-invalid'
  | 'currency-invalid'
  | 'not-found'
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

export function isValidRequestAmount(amount: string): boolean {
  if (!REQUEST_AMOUNT_PATTERN.test(amount)) return false;
  return Number(amount) > 0;
}

/** The public id: 18 hex characters from 9 random bytes. Opaque, unguessable, and the link's capability. */
function newPublicId(): string {
  return randomBytes(9).toString('hex');
}

export interface CreateRequestInput {
  /** The account asking. */
  creatorId: string;
  /** The handle asked, as the customer typed or picked it. */
  payeeHandle: string;
  /** A decimal string in `currency`. */
  amount: string;
  currency?: string;
  memo?: string;
  expiresAt?: Date | null;
}

export interface CreatedRequest {
  id: string;
  publicId: string;
  payeeHandle: string;
  payeeAddress: string;
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

  const handle = await findHandleByHandle(input.payeeHandle);
  if (!handle) throw new PaymentRequestError('payee-not-found');

  // Asking yourself is not a request; it is a mis-tap that would sit in your Activity for ever.
  if (handle.userId === input.creatorId) throw new PaymentRequestError('payee-is-you');

  const row = await prisma.paymentRequest.create({
    data: {
      publicId: newPublicId(),
      creatorId: input.creatorId,
      payeeHandleId: handle.id,
      payeeHandleText: handle.handle,
      payeeAddress: handle.address.toLowerCase(),
      amount: input.amount,
      currency,
      memo: input.memo?.trim() ?? '',
      expiresAt: input.expiresAt ?? null,
    },
  });

  return {
    id: row.id,
    publicId: row.publicId,
    payeeHandle: row.payeeHandleText,
    payeeAddress: row.payeeAddress,
    amount: row.amount,
    currency: row.currency,
    memo: row.memo,
    status: 'open',
  };
}

export interface SettleRequestInput {
  publicId: string;
  /** The ledger row that paid it. */
  transactionId: string;
  /** The chain hash, for support and the receipt link. */
  txHash: string;
}

/**
 * Mark an ask paid. Called by the send path, in the same transaction as its ledger write.
 *
 * A refusal never throws for a request that is already settled — it reports WHICH payment settled it,
 * because the caller's next sentence is "this was already paid" and it cannot say that without the id.
 */
export async function settleRequest(input: SettleRequestInput): Promise<void> {
  const changed = await prisma.paymentRequest.updateMany({
    where: { publicId: input.publicId, status: 'open' },
    data: {
      status: 'settled',
      settledTransactionId: input.transactionId,
      settledTxHash: input.txHash,
      settledAt: new Date(),
    },
  });

  if (changed.count === 1) return;

  const existing = await prisma.paymentRequest.findUnique({
    where: { publicId: input.publicId },
    select: { status: true, settledTransactionId: true },
  });

  if (!existing) throw new PaymentRequestError('not-found');
  if (existing.status === 'settled') {
    throw new PaymentRequestError('already-settled', existing.settledTransactionId ?? null);
  }
  throw new PaymentRequestError('already-cancelled');
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
  payeeHandle: string;
  amount: string;
  currency: string;
  memo: string;
  status: 'open' | 'settled' | 'cancelled';
  createdAt: Date;
  settledTxHash: string | null;
}

/** The asks one account made, newest first: the Activity rows (#98 AC4). */
export async function listRequests(creatorId: string): Promise<RequestSummary[]> {
  const rows = await prisma.paymentRequest.findMany({
    where: { creatorId },
    orderBy: { createdAt: 'desc' },
    select: {
      publicId: true,
      payeeHandleText: true,
      amount: true,
      currency: true,
      memo: true,
      status: true,
      createdAt: true,
      settledTxHash: true,
    },
  });

  return rows.map((row) => ({
    publicId: row.publicId,
    payeeHandle: row.payeeHandleText,
    amount: row.amount,
    currency: row.currency,
    memo: row.memo,
    status: row.status,
    createdAt: row.createdAt,
    settledTxHash: row.settledTxHash,
  }));
}

/** What a payer's link resolves to. The same read the settle step uses, and it is public by design. */
export interface PublicRequest {
  publicId: string;
  payeeHandle: string;
  payeeAddress: string;
  amount: string;
  currency: string;
  memo: string;
  status: 'open' | 'settled' | 'cancelled';
}

export async function readPublicRequest(publicId: string): Promise<PublicRequest | null> {
  const row = await prisma.paymentRequest.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      payeeHandleText: true,
      payeeAddress: true,
      amount: true,
      currency: true,
      memo: true,
      status: true,
    },
  });

  if (!row) return null;
  return {
    publicId: row.publicId,
    payeeHandle: row.payeeHandleText,
    payeeAddress: row.payeeAddress,
    amount: row.amount,
    currency: row.currency,
    memo: row.memo,
    status: row.status,
  };
}
