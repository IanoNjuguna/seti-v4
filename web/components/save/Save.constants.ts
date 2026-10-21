/**
 * Every word the Save screen renders.
 *
 * Shaped by Cash App's own savings page, because that is the page this is modelled
 * on: one figure, what it earns, two actions — `Add money` / `Withdraw`. Their four
 * promises translate to three we can keep and one we must not fake:
 *
 *   "Earn interest"                 → the rate when the vault publishes one, and a
 *                                    plain "unavailable" when it does not;
 *   "Start with as little as $1"    → there is no minimum here, so we claim none;
 *   "Transfer from savings anytime" → true only if the vault redeems synchronously,
 *                                     which the withdraw slice checks rather than
 *                                     promising in copy;
 *   "No separate account"           → ours is stronger: you still own it.
 */
export const SAVE_COPY = {
  title: 'Save',
  savedLabel: 'Saved',
  availableLabel: 'Available',
  empty: 'Money you set aside earns interest. You can take it out any time.',
  rateUnavailable: 'Rate unavailable right now',
  earnedLabel: 'Earned so far',
  earnedUnknown: 'Earnings not measurable yet',
  addAction: 'Add money',
  withdrawAction: 'Withdraw',
  withdrawUnavailable: 'Nothing saved yet',
  amountTitle: 'How much are you saving?',
  amountLabel: 'Amount to save',
  amountPlaceholder: '0.00',
  amountInputId: 'save-amount',
  amountHint: 'From your available balance.',
  amountNote: 'Swapped into the vault and starts earning straight away.',
  amountButton: 'Add to savings',
  cancel: 'Cancel',
  paused: 'Savings are paused right now. Nothing can be added.',
  deposited: 'Saved',
  depositedBody: 'It is earning now, and you can withdraw it any time.',
  done: 'Done',
  /** The custody sentence: the thing a customer most wants to know. */
  custodyNote: 'Your money sits in a Tempo vault in your own name. Seti never holds it.',
} as const;

/** What a customer with no account sees. */
export const SAVE_SIGNED_OUT_COPY = {
  title: 'Sign in to save',
  body: 'Money in savings comes out of your own balance.',
} as const;
