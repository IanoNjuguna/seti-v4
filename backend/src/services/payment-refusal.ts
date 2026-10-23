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
  | 'quote-not-yours'
  /**
   * The convert path's own refusals.
   *
   * A convert is verified from two legs rather than one, and neither leg has a
   * counterparty: the input goes to the DEX precompile and the output comes back
   * from it. They are named separately from `transfer-not-found` because the fix
   * is different in each case — a missing input leg means the money never left the
   * wallet, a missing output leg means the book did not pay out — and because a
   * conversion that under-delivers against the floor the customer SIGNED is not a
   * mismatch to be tolerated at 1%, it is a refusal.
   */
  | 'convert-pair-unavailable'
  | 'convert-leg-unverified'
  | 'convert-below-floor'
  /** Both sides of a convert named the same asset, so nothing would move. */
  | 'convert-same-asset'
  /**
   * A savings deposit's legs did not all verify: the OUSD did not leave, the
   * pathUSD did not reach the vault, or the vault minted no shares to the wallet.
   *
   * Named separately from a payment's `transfer-not-found` because the fix is
   * different — a deposit has three legs and the customer's money is mid-flight
   * between them, so the sentence has to say WHICH one failed rather than "not
   * found".
   */
  | 'savings-leg-unverified'
  /**
   * The charge path's refusals (`services/charge.ts`).
   *
   * A charge is a signed request for a stranger on the internet to be paid, and a
   * classifier decides its status from an observed transfer with no chain, no
   * database and no user. These codes name the ways that decision refuses. They
   * live HERE, in the one taxonomy, rather than in a vocabulary of their own: a
   * surface that already renders a refusal code renders these too, and support has
   * one list to search.
   *
   * They reuse `receipt-unavailable` and `amount-invalid` where the fact is the
   * same fact a payment already names — an unconfirmed transfer is an unconfirmed
   * transfer whichever object asked.
   */
  /** The charge is already decided; nothing leaves a terminal state. */
  | 'charge-not-pending'
  /**
   * The charge's signature does not recover to its own `recipient`. The link was
   * edited in flight (amount, memo, expiry, nonce), so what the page shows is not
   * what the payee signed.
   */
  | 'charge-signature-invalid'
  /**
   * The recipient is a CONTRACT (a Safe, a smart account), so an ECDSA recovery cannot
   * answer for it at all. Distinct from `charge-signature-invalid` on purpose: the
   * signature may be perfectly authentic, and telling a merchant they forged their own
   * charge is a false accusation. EIP-1271 verification is not built yet, so this code
   * says "we cannot check this kind of signer", which is the truth.
   */
  | 'charge-signature-contract-wallet'
  /** The charge is past `expiresAt` — or its expiry cannot be read — so it is inert. */
  | 'charge-expired'
  /** The transfer paid an address other than the charge's recipient. */
  | 'recipient-mismatch'
  /** The transfer moved a different token than the charge names. */
  | 'asset-mismatch'
  /**
   * The transfer's memo does not carry the charge id. A TIP-20 transfer has no
   * other identifier, so without it a reused link cannot be told apart from an
   * unrelated transfer.
   */
  | 'memo-missing-charge-id'
  /**
   * The charge API's OWN refusals (`routes/public-charges.ts`) — the ways a request
   * to create or manage a charge fails before a classifier is ever asked.
   *
   * These are named separately from the classifier's codes because the fix is
   * different in each case and the client acts on them differently: `charge-expired`
   * is a fact about a charge, `charges-rate-limited` is a fact about the caller.
   */
  /** The id is not a usable charge id (an id is lower-case `[a-z0-9_-]`, 6–64 chars). */
  | 'charge-id-invalid'
  /** This recipient already has a charge with this id, and it is not this signature. */
  | 'charge-id-taken'
  /** The same `Idempotency-Key` was used for a different charge. */
  | 'idempotency-key-reused'
  /** The create body's amounts, expiry or asset cannot describe a charge at all. */
  | 'charge-invalid'
  /** `webhookUrl` is not an https URL (http is allowed only for localhost in development). */
  | 'webhook-url-invalid'
  /**
   * A managing call's signature was issued outside its window — a captured header
   * that has expired. Distinct from `charge-signature-invalid` so a caller is told
   * "your clock, or a stale header" rather than "wrong key".
   */
  | 'charge-admin-stale'
  /**
   * The per-address or per-source budget for a charge route is spent.
   *
   * Not charge-specific: any unauthenticated write that creates rows needs it, and the
   * code says what to do (wait) rather than what went wrong.
   */
  | 'rate-limited'
  /**
   * The arrival path's own refusal (`services/arrival.ts`).
   *
   * A transfer reached a merchant's address, and a charge at that address already
   * records this exact transaction as the one that settled it. The money is that
   * charge's and the charge path has recorded it, so the same transaction must not
   * also be filed as an unattributed arrival: that would count one transfer twice
   * and tell the merchant their money is both a charge payment and a stray.
   */
  | 'arrival-is-charge-settlement'
  /**
   * The merchant app's own refusals (`routes/merchant-apps.ts`, #156).
   *
   * A merchant app is a name a wallet SIGNED for, bound to the address its charges
   * are paid at, plus the webhook secret Seti issues for it. These codes name the ways
   * creating, reading or rotating one fails, and each names a different fix.
   */
  /** The EIP-712 binding signature does not recover to the claimed payout address. */
  | 'merchant-app-signature-invalid'
  /** The binding signature was issued outside its window (five minutes either way). */
  | 'merchant-app-stale'
  /** The signed fields and the submitted fields disagree (the name, the URL, the address). */
  | 'merchant-app-mismatch'
  /** The payout address is not usable, or is not one of the caller's own wallets. */
  | 'merchant-app-address-not-owned'
  /** This account already has an app with this name. */
  | 'merchant-app-name-taken'
  /** The webhook URL is not https (http is allowed only for localhost in development). */
  | 'merchant-app-webhook-invalid'
  /**
   * No secret-box key is configured, so a webhook secret cannot be sealed. Refused
   * BEFORE any row is written, because an app whose secret cannot be opened is an app
   * whose webhooks can never be verified.
   */
  | 'secret-box-unset'
  /**
   * The app exists and this caller cannot see it. Uniform for "not found" and "not
   * yours": whether another account owns a given id is not this caller's business.
   */
  | 'merchant-app-not-found'
  /** The app was revoked: its secret is gone, so there is nothing to rotate or replay. */
  | 'merchant-app-revoked'
  /** The delivery id is not one of this app's deliveries. */
  | 'delivery-not-found'
  /** That delivery already succeeded, so a replay would be a second POST for one event. */
  | 'delivery-not-replayable';

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
