/**
 * The one sentence the empty activity state says, and the one action beside it.
 *
 * They are constants rather than literals in the component so the shared empty
 * state — the home screen's recent-activity section and the Activity screen's
 * list (`ActivityStates` renders the same block) — cannot drift into two
 * voices for one idea.
 *
 * The sentence INVITES the action instead of describing the outcome. It used to
 * read as an explanation ("Pay a Seti merchant and it appears here…"), which
 * told a brand-new account what this list was for and left it there; the slot is
 * empty, so the useful thing to do with it is ask for the payment. Same shape,
 * same length, different job.
 *
 * The receipt clause stays, and it is the point of the sentence rather than
 * decoration: it is the trust claim a first-time sender needs — the money is
 * PROVEN, not merely gone — and it is what this screen can promise about a
 * payment that has not happened yet. Nothing about it is a deadline, so the
 * action is not pushed "today": urgency is not the reason to send, and a fake
 * clock is how an empty state starts sounding like marketing.
 *
 * The action is the sentence's own verb, short and imperative, because it sits
 * directly under it as an affordance (`EmptyActivity`) rather than as a second
 * claim. It says nothing about how the app works, names no currency, and
 * nothing here says "bank", "account holder" or "custody".
 */
export const EMPTY_ACTIVITY_COPY = {
  message: 'Send money to someone and it appears here, with its receipt.',
  action: 'Send money',
} as const;

/**
 * Where the action goes: the app's one send flow.
 *
 * A route, not copy, but it lives here with the label it belongs to. It is a
 * plain destination — `/app/send` decides for itself whether there is an account
 * to send with (`SendScreen` → `SendSignedOut`), so this link does not gate
 * anything and does not need to know who is reading it.
 */
export const EMPTY_ACTIVITY_SEND_HREF = '/app/send';
