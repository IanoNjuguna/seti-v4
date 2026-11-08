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

/**
 * The amount figure's own words (#440).
 *
 * `keypadLabel` names the grid for a screen reader, because a `3x4` block of single characters
 * announces as a run of digits with no subject otherwise.
 */
export const PAY_AMOUNT_COPY = {
  amountLabel: 'Amount to pay',
  keypadLabel: 'Amount keypad',
  backspace: 'Delete last digit',
} as const;

/**
 * The figure, at the size the screen is about.
 *
 * One class and no breakpoint step, for the reason `SWAP_FIGURE_CLASS` gives: this column is the
 * same width at every breakpoint, and a `sm` step loses to emission order in a fight nobody can
 * see. Mono and tabular because every figure in this app is. `display-md` (40px) rather than
 * `display-lg`: at 390 a `KES 12,345.00` figure has to stay on one line beside its currency, and
 * 48px is the size where it starts to wrap.
 *
 * LEFT-aligned, and the unit sits immediately before the figure. The app writes money unit-first
 * everywhere (`KES 510.35` in the quote rows below), so a right-aligned figure with its currency
 * stranded at the opposite edge of the row reads as a label and a value rather than as one number.
 */
export const PAY_FIGURE_CLASS =
  'block w-full min-w-0 bg-transparent p-0 text-left font-mono font-tabular font-medium text-display-md text-ink outline-none placeholder:text-mute disabled:opacity-60';

/**
 * The keypad's keys, in reading order.
 *
 * `muted` is the decimal key: it is a real key, but it is not a digit, and the grid reads better
 * when the two populations are distinguishable.
 */
export const PAY_KEYPAD_KEYS: ReadonlyArray<{ label: string; value: string; muted?: boolean }> = [
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
  { label: '7', value: '7' },
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '.', value: '.', muted: true },
  { label: '0', value: '0' },
  { label: '⌫', value: 'back', muted: true },
];
