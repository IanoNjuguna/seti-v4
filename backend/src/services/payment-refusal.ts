import { logAuditEvent } from './audit.js';

/**
 * Machine-readable reasons a payment was refused.
 *
 * Support's hardest case is the payment that never landed. Those are the
 * refusals, and before this existed a refusal threw a bare `Error` out of
 * `recordPayment`, which the route turned into a 500: no transaction row, no
 * audit row, and the reason surviving only in a log line and a response body.
 * The customer's txHash was the only durable handle on the event.
 *
 * Every refusal now carries one of these codes, and every refusal is written to
 * `audit_logs` (action `payment.rejected`, keyed by `txHash`) before it is
 * thrown — so a support lookup by the hash the customer pastes finds the story
 * even though no transaction row exists.
 */
export type PaymentRefusalCode =
  /** The user has no active wallet for the asset being paid with. */
  | 'no-active-wallet'
  /** No merchant matches the id the QR resolved to. */
  | 'merchant-not-found'
  /**
   * The merchant has no on-chain address, so there is nothing to reconcile
   * against. Fails closed rather than taking an unverified path.
   */
  | 'merchant-no-payout-address'
  /** The claimed amount is not a positive finite number. */
  | 'amount-invalid'
  /** The receipt is not yet available (not mined, or a provider error). */
  | 'receipt-unavailable'
  /** The transaction is on-chain and reverted. */
  | 'receipt-reverted'
  /** The receipt is readable but contains no matching Transfer for the leg. */
  | 'transfer-not-found'
  /** The chain moved a materially different amount than the client claimed. */
  | 'amount-mismatch'
  /** Batch mode: the merchant leg resolved but the fee leg did not. */
  | 'fee-leg-unverified'
  /**
   * The address a send was aimed at is unusable — not 20 bytes, or a bad EIP-55
   * checksum. Named separately from `merchant-not-found` because the fix is on
   * the address the customer typed, not on a merchant record.
   */
  | 'recipient-invalid'
  /** A send aimed at the sender's own wallet: nothing moves and gas is still spent. */
  | 'recipient-is-self'
  /**
   * A send was attempted while the server is in `inside-transfer` mode, where
   * there is no second leg and the 2% would be handed to the recipient.
   */
  | 'send-requires-batch'
  /**
   * A recorded transfer is bound to the wallet that SIGNED it, so the record path
   * requires the client to declare that address — the `from` of the transfer —
   * because only the browser knows which of an account's embedded wallets it
   * signed with. An account can hold SEVERAL embedded wallets, so "the user's
   * active wallet" is not the wallet that signed.
   *
   * These three codes are the ways that declaration fails to hold, and each one
   * fails closed rather than picking a wallet to write:
   *
   * - `signer-not-declared`: nothing was declared, so there is no wallet to bind
   *   the row to. Picking one here is what bound rows to whatever wallet the
   *   lookup happened to find; the binding, and every `mine` flag and total
   *   computed from it, could then be wrong.
   * - `signer-not-owned`: the declared address is not one of the caller's
   *   wallets, or is not a usable address. A declared address is the client
   *   naming which of ITS OWN wallets it used, never an assertion of identity.
   * - `signer-mismatch`: the declared address is not the sender the chain recorded
   *   for the transaction being recorded. The row would name a wallet that did
   *   not sign this transfer.
   */
  | 'signer-not-declared'
  | 'signer-not-owned'
  | 'signer-mismatch'
  /**
   * The frozen rate was signed for a DIFFERENT network than the one this record
   * path is writing on. A practice quote must never settle a live payment (or the
   * reverse): the figure it carries is a practice figure, and writing it into the
   * other network's ledger is the money hazard the network dimension closes.
   */
  | 'quote-wrong-network'
  /**
   * The FX rate is frozen at quote time and carried as a signed quote token. The
   * record path refuses — never falls back to the live rate — when that token is
   * absent, malformed or forged, has outlived its TTL, or belongs to another
   * account. Without this the rate the customer was shown and the rate written to
   * the ledger could differ across a cache refresh.
   */
  | 'quote-missing'
  | 'quote-invalid'
  | 'quote-expired'
  | 'quote-not-yours';

/** Why an on-chain receipt could not be used to verify a leg. */
export type ReceiptFailureCode =
  | 'receipt-unavailable'
  | 'receipt-reverted'
  | 'transfer-not-found';

export interface PaymentRefusalInput {
  userId: string;
  /**
   * The hash the customer signed. Required, not optional: it is the correlation
   * key support searches by, and a refusal that cannot be looked up by hash is
   * not an improvement over a 500.
   */
  txHash: string;
  code: PaymentRefusalCode;
  /** Human-readable detail. Becomes `error.message`, so the copy is the contract. */
  reason: string;
  merchantId?: string;
  /** What the client claimed moved, when the refusal is about an amount. */
  claimedAmount?: number;
  /** What the chain actually moved, when the refusal is about an amount. */
  observedAmount?: number;
}

export class PaymentRefusalError extends Error {
  readonly code: PaymentRefusalCode;
  readonly txHash: string;
  readonly merchantId?: string;

  constructor(input: PaymentRefusalInput) {
    super(input.reason);
    this.name = 'PaymentRefusalError';
    this.code = input.code;
    this.txHash = input.txHash;
    this.merchantId = input.merchantId;
  }
}

/**
 * Records a refused payment and returns the error to throw.
 *
 * Always call it as `throw await refusal({ ... })`.
 *
 * Two reasons for that shape. The audit write has to complete *before* control
 * leaves the caller, so it cannot be fire-and-forget. And TypeScript does not
 * treat `await` of a `Promise<never>` as terminating control flow, so a
 * `refuse()` that throws internally leaves every value it guarded still
 * possibly-unset for the compiler — the explicit `throw` is what narrows.
 *
 * The audit write is best-effort on purpose: if the database is the thing that
 * is broken, the failure to *record* the refusal must not replace the refusal
 * itself, or the client gets a database error instead of a diagnosis and the
 * reason is lost twice. The write failure is logged loudly and the refusal is
 * still returned.
 */
export async function refusal(input: PaymentRefusalInput): Promise<PaymentRefusalError> {
  try {
    await logAuditEvent({
      userId: input.userId,
      action: 'payment.rejected',
      txHash: input.txHash,
      metadata: {
        code: input.code,
        reason: input.reason,
        ...(input.merchantId ? { merchantId: input.merchantId } : {}),
        ...(input.claimedAmount !== undefined ? { claimedAmount: input.claimedAmount } : {}),
        ...(input.observedAmount !== undefined ? { observedAmount: input.observedAmount } : {}),
      },
    });
  } catch (error) {
    console.error(
      '[refusal] could not record the refusal in audit_logs',
      { code: input.code, txHash: input.txHash },
      error instanceof Error ? error.message : error
    );
  }

  return new PaymentRefusalError(input);
}
