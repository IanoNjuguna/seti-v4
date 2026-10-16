import type { SignInStage, SignInStageInput } from './SignInScreen.types';

/**
 * Which screen the sign-in page is showing, from the session and the page's own
 * memory of what has been pressed.
 *
 * Pure, and a `switch`-free ladder rather than a chain of ternaries in JSX, so
 * the rule is readable in one place and testable without a render.
 *
 * The two rules that are not obvious:
 *
 *  - **`sending` and `error` mean different stages depending on where the person
 *    is.** The FIRST send belongs to the address step (the button spins there),
 *    while a re-send or a rejected code belongs to the sent screen — so the
 *    page would flip back to the email field mid-flight, or hand a mistyped code
 *    back as an empty form, if `signInStatus` alone decided it. That is what
 *    `pastFirstSend` is for.
 *  - **`dismissedSent` outranks the session.** The provider keeps the last
 *    attempt at `sent` (it owns what happened, not what is on screen), so
 *    "use a different email" is the page saying "show me the address step
 *    anyway". It is cleared the moment a new address is submitted.
 */
export function resolveSignInStage(input: SignInStageInput): SignInStage {
  const { status, signInStatus, source, pastFirstSend, dismissedSent, previewSent } = input;

  if (status === 'restoring') return 'restoring';
  if (status === 'signed-in') return 'signed-in';
  // Dev-source only, and the hook never sets it on a Privy build.
  if (source === 'dev' && previewSent) return 'sent';
  if (dismissedSent) return 'entry';
  if (signInStatus === 'sent') return 'sent';
  if (pastFirstSend && (signInStatus === 'sending' || signInStatus === 'error')) return 'sent';
  return 'entry';
}
