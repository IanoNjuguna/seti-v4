/**
 * What the claims band on Activity says (#465).
 *
 * A claim is the thing a customer sends, so every sentence here is written from their side of
 * it: a claim they are waiting on, one that lapsed, one they withdrew. No sentence promises a
 * single payment, because whether one link can be paid twice is #449 and still undecided.
 */
export const CLAIMS_COPY = {
  /** Names the group for a screen reader. The visible heading is `label`. */
  sectionLabel: 'Claims',
  label: 'Claims',
  /**
   * The row's title when the customer wrote no memo. "Claim" rather than the link or the id:
   * the person paying is whoever opens the shared link, so there is no name to print.
   */
  titleFallback: 'Claim',
  /**
   * Under the title: the name the money reaches, then when it was made.
   *
   * The name comes FIRST because the subtitle is the row's one truncating column, and at 320px it
   * cuts the tail: "8 Nov · paid to …" would hide the only part a customer needs to know about a
   * claim. "paid to @ian · 8 N…" gives up the date instead, which the ledger below prints anyway.
   * "Shared" was never worth the width — the date already says when.
   */
  subtitle: (shared: string, handle: string): string => `paid to @${handle} · ${shared}`,
  /** The state word, in the customer's terms, under the amount. */
  states: {
    open: 'Waiting',
    cancelled: 'Withdrawn',
    expired: 'Lapsed',
    settled: 'Paid',
  },
  /** The one action an open claim has. It names the amount, because a list has several. */
  cancel: 'Cancel',
  cancelLabel: (amount: string): string => `Cancel the claim for ${amount}`,
  cancelling: 'Cancelling',
  /** A claim that would not close. The reason is the server's, so this is the frame only. */
  cancelFailed: "Couldn't cancel that claim. Try again.",
} as const;
