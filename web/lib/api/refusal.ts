import { ApiError } from './client';
import { REFUSAL_NETWORK, REFUSAL_UNKNOWN, refusalMessageFor } from './refusal.constants';

/**
 * What failed, from the screen's point of view. The CODE says what went wrong;
 * the flow says what to do about it, which is why it is the caller's to name.
 */
export type RefusalContext =
  | 'account'
  | 'activity'
  | 'statement'
  | 'payment'
  | 'send'
  | 'convert'
  | 'claim'
  | 'lookup'
  | 'receipt';

/** The heading a state card uses for this flow. */
const TITLE: Record<RefusalContext, string> = {
  account: 'Could not load your account',
  activity: 'Could not load your activity',
  statement: 'Could not make your statement',
  payment: 'Payment not sent',
  send: 'Transfer not sent',
  convert: 'Not converted',
  claim: 'Name not claimed',
  lookup: 'Could not find that merchant',
  receipt: 'Could not open the receipt',
};

/**
 * What to do next, when there is no code to say anything more specific.
 *
 * This is the sentence a person gets instead of a fault they cannot act on, and
 * it is per-flow because the next step is: a failed read is worth retrying, a
 * failed payment needs the wallet checked first. A payments app that says only
 * "something went wrong" leaves the customer guessing whether money moved.
 */
const NEXT_STEP: Record<RefusalContext, string> = {
  account: 'Try again — nothing was changed.',
  activity: 'Try again in a moment.',
  statement: 'Nothing was downloaded. Try again in a moment.',
  payment: 'Nothing was sent. Try again, or check your wallet first.',
  send: 'Nothing was sent. Try again, or check the details above.',
  convert: 'Nothing was converted. Try again, or check the amount above.',
  claim: 'Nothing was claimed. Try again.',
  lookup: 'Check the spelling, or paste the link again.',
  receipt: 'Try again in a moment.',
};

/**
 * A code that repeating the action will not fix, because the customer has to
 * change something first — sign in again, add money, or edit the entry. Offering
 * a Retry button for these is how a screen teaches someone to press it twice.
 */
const NOT_RETRYABLE = new Set([
  'unauthorized',
  'not-a-token',
  'invalid-handle-name',
  'handle-taken',
  'reserved-handle',
  // The signer is not a wallet this account holds: pressing the same button with
  // the same wallet fails identically, so the fix is a different sign-in, not a
  // retry.
  'address-not-owned',
  'recipient-is-self',
  'merchant-no-payout-address',
  'inside-transfer',
  'mainnet-not-ready',
  'invalid-intent',
  'invalid-kind',
  'invalid-network',
  'amount-invalid',
]);

export interface Refusal {
  /** The heading for the state card. */
  title: string;
  /** One sentence a person can act on. NEVER the server's own words. */
  message: string;
  /**
   * The correlation id the server minted for this request, or null.
   *
   * Returned so a caller CAN carry it. It is not rendered by default — a hex id in
   * the middle of a payment screen is the server's problem handed to a customer —
   * but a surface that shows a specific reason may print it BESIDE that reason
   * (the claim form does: see `components/merchant/Claim.error.ts`), because the
   * reason is deliberate copy and the id is the only thing that finds the log line
   * behind it.
   */
  requestId: string | null;
  /** True only when pressing the same control again is a sensible next step. */
  retryable: boolean;
}

/**
 * Turn anything thrown by a request into copy a person can read.
 *
 * Two things this deliberately does NOT do:
 *
 *  - **It does not show the server's sentence.** `ApiError.message` is already
 *    ours (mapped at construction), and anything that is not an `ApiError` — a
 *    TypeError, a wallet SDK error, a programming mistake — is replaced by the
 *    flow's next-step line rather than rethrown into the UI. A customer never
 *    reads a stack, a column name or a vendor's phrasing.
 *  - **It does not dump the request id.** It is returned so the caller can carry
 *    it (and so a future support flow can offer it), not so that a hex string
 *    lands in the middle of a payment screen.
 *
 * A network failure and a refusal produce the same shape on purpose: from the
 * customer's side they are one event, and neither is more alarming than the other.
 */
export function refusal(error: unknown, context: RefusalContext): Refusal {
  if (error instanceof ApiError) {
    const code = error.code;
    // A network timeout and a parse failure have no code; their `message` is
    // already the calm transport sentence, which reads better than a generic.
    const message =
      code === undefined
        ? error.message || REFUSAL_NETWORK
        : refusalMessageFor(code);

    return {
      title: TITLE[context],
      message,
      requestId: error.requestId ?? null,
      retryable: code === undefined ? true : !NOT_RETRYABLE.has(code),
    };
  }

  return {
    title: TITLE[context],
    message: NEXT_STEP[context] || REFUSAL_UNKNOWN,
    requestId: null,
    retryable: true,
  };
}

/**
 * Just the sentence, for the hooks that already hold a flow context and only
 * need a string — the shape `toErrorMessage` had, with the guarantee added.
 */
export function refusalMessage(error: unknown, context: RefusalContext): string {
  return refusal(error, context).message;
}
