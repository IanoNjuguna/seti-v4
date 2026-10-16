/**
 * The pay action's own words.
 *
 * `/app/pay` has no console of its own — it forwards to the send flow — but
 * paying is a named thing on Home and in the chrome, so the one sentence that
 * stands in the way of a visitor paying belongs to the pay surface rather than
 * borrowing the send flow's: a customer who tapped `Pay` is told what `Pay`
 * needs, in the same words.
 */
export const PAY_SIGNED_OUT_COPY = {
  title: 'Sign in to pay',
  body: 'Paying moves money out of your own account.',
} as const;

/**
 * The merchant amount step's words.
 *
 * These were inline in the step, next to a message that is gone: the step used to
 * draw its own "Finding the merchant / One moment — their profile decides how
 * this payment is priced." card while the same wait was already drawn by the
 * merchant card's skeleton, which is a card around a sentence the customer had
 * already been shown.
 *
 * `nothingMoved` is appended ONLY when no transaction hash exists. A failed
 * payment has one question to answer — did my money move? — and no broadcast
 * means no, so say so. Once a hash exists the money DID move and only the
 * recording failed, so nothing is added: the sentence already carries it.
 */
export const PAY_STEP_COPY = {
  amountLabel: 'Amount',
  errorTitle: 'Payment not sent',
  nothingMoved: 'Nothing left your wallet.',
} as const;
