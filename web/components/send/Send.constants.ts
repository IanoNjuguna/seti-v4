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
  byName: 'Yes — I have their name or link',
  byAddress: 'No — I will use their wallet address',
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
