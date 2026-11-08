/**
 * What a customer's own claims say (#465).
 *
 * The two words that matter are shared with the payer's side (`claim-lines.ts`): a claim is PAID or
 * WITHDRAWN, and a lapsed one has EXPIRED. The state is the server's — `requestState` derives `expired`
 * from `expiresAt` on read — so this file names states and never decides one.
 */
export const CLAIMS_COPY = {
  title: 'Claims you sent',
  /** Under each row: what the claim was for, or who it is owed from. */
  to: (handle: string): string => `From @${handle}`,
  empty: 'No claims yet. A claim is a link with an amount in it.',
  withdraw: 'Withdraw',
  withdrawing: 'Withdrawing',
  withdrawFailed: "Couldn't withdraw that claim. Try again.",
  loadFailed: "Couldn't load your claims.",
} as const;

/** The one word each state gets, in the customer's language. */
export const CLAIM_STATE_LABEL = {
  open: 'Waiting',
  settled: 'Paid',
  cancelled: 'Withdrawn',
  expired: 'Expired',
} as const;

/**
 * Which states still want something from the reader.
 *
 * Only `open` can be withdrawn: a settled claim is a fact about a payment, a withdrawn one is already
 * gone, and a lapsed one cannot be paid, so offering an action on any of the three would be a control
 * whose only outcome is a refusal.
 */
export function isOpen(state: keyof typeof CLAIM_STATE_LABEL): boolean {
  return state === 'open';
}
