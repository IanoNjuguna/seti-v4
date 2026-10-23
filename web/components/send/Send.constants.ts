/**
 * Every word the send flow renders.
 *
 * The flow is ONE question and one amount, so the copy carries the question and
 * nothing else: "who is this going to" is answered by the two choices, and the
 * payee's own details come from the server once the name resolves. A sentence
 * explaining the flow would be a sentence nobody reads before choosing.
 *
 * The steps are `Who` and `Amount` — two, not three. The commit is the button at
 * the end of the amount step in both branches (a person's send and a merchant's
 * payment both sign from there), so a third node would be lit by nothing.
 */
export const SEND_FLOW_COPY = {
  title: 'Send money',
  progressLabel: 'Send progress',
  steps: ['Who', 'Amount'] as const,
  question: 'Do they have a Seti account?',
  /** The two answers, in the customer's words. */
  byName: 'Yes, I have their name or link',
  byAddress: 'No, I will use their wallet address',
  nameLabel: 'Their Seti name or link',
  nameHint: 'A name like javahouse, or the link they gave you.',
  addressLabel: 'Their wallet address',
  addressHint: 'The whole address, exactly as they sent it.',
  continueAction: 'Continue',
  resolving: 'Looking them up…',
  resolveFailedTitle: 'We could not find that name',
  changeRecipient: 'Change who this is going to',
  loading: 'Loading the send flow',
} as const;

/**
 * The people this account has paid before: the send screen's repeat entry (#99).
 *
 * Three words and the list: a label, then one row per person, each row the whole
 * tap target (`ChoiceRow`). The rows are drawn ONLY when there is somebody to draw
 * (acceptance 3): an account with no history gets no heading and no empty box, so
 * the field underneath is the only thing on the step and nothing has to be
 * explained away.
 *
 * Nothing shows an amount. A repeat fills the payee and the customer types the
 * figure, which is why these rows are deliberately not a "send again" button.
 */
export const RECENT_RECIPIENT_COPY = {
  label: 'Paid before',
  loading: 'Loading people you paid before',
  /**
   * A failed read says so in one quiet line, in this block's own voice. It is not a
   * state card and it does not touch the field: typing a name still works, and an
   * error panel over a screen whose main control is intact would claim more broke
   * than did.
   */
  unavailable: 'Could not load people you paid before. Type their name instead.',
} as const;

/**
 * What the flow says to someone with no account.
 *
 * The ACTION is what needs an account, so this is where the ask belongs — the
 * entry points that lead here stay visible and tappable (`HomeActions` on Home),
 * and a visitor meets this instead of a flow that would sign for them. Plain,
 * second person, and it names the reason rather than the mechanism: money leaves
 * the CUSTOMER's account, which is why there has to be one.
 */
export const SEND_SIGNED_OUT_COPY = {
  title: 'Sign in to send money',
  body: 'Sending moves money out of your own account.',
} as const;
