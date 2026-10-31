import type { SessionProblem } from './auth.types';

/**
 * What the app says when a stored session could not be established, and what it
 * says when a sign-in attempt fails (#284).
 *
 * ## Two events, two sentences, one action each
 *
 * The restore used to fail into ONE sentence for every cause: the server refusing
 * the token, the server being unreachable, and the stored account disagreeing with
 * the token all produced a paragraph that wrapped the mapped refusal in brackets
 * and then told the person to sign in again as well. It asked for two different
 * things at once, and it named a reason nobody can act on.
 *
 * A customer is in one of two situations, and they are not the same situation:
 *
 *  - the session is over, and the only thing that works is signing in again;
 *  - Seti did not answer, which is not the session's fault, so the session is
 *    KEPT and the phone/laptop is what gets retried.
 *
 * So the heading carries the action (`Sign in again`) or the fault (`Seti is not
 * answering`), and the sentence under it says what happened. A message never
 * contains a second instruction, a bracket, an em dash, or a token name.
 *
 * ## The mismatch case is deliberately folded into the expiry
 *
 * A stored account that disagrees with the token (a stale snapshot from before an
 * account switch, or an edited localStorage entry) used to be named in the
 * sentence: "The session stored on this device said a@b, but the token belongs to
 * c@d." That is a diagnostic, not an action, and the person looking at it can only
 * sign in again either way. If tamper reporting is ever wanted it belongs in
 * telemetry keyed on the same event, not in the middle of the front door.
 */
export const SESSION_ENDED: SessionProblem = {
  title: 'Sign in again',
  message: 'Your session ended.',
};

/**
 * Seti did not answer — offline, DNS, a blocked origin, a Worker or backend that
 * is deploying, or a 5xx.
 *
 * It names OUR side on purpose. The obvious line, "Check your connection and try
 * again", blames the customer for our deploy, and someone who is online will
 * toggle wifi and still fail. The stored session is NOT cleared for this event
 * (`session-bootstrap.ts`), so the next load restores them without an email code.
 */
export const SESSION_UNREACHABLE: SessionProblem = {
  title: 'Seti is not answering',
  message: 'Try again in a moment.',
};

/**
 * The heading for a sign-in attempt that failed for a reason of its own — a
 * mistyped code, a refused address, a missing Privy app id, a stale Terms
 * version.
 *
 * The sentence beside it is the specific one that flow wrote
 * (`auth.constants.ts`, `refusal.constants.ts`); only the heading is shared, and
 * it says what the block is: an attempt that did not get in.
 */
export const SIGN_IN_FAILED_TITLE = 'Could not sign in';
