/**
 * Copy the app's signed-out card owns.
 *
 * The card is the app's standard ask for an account on a surface that is a page in
 * its own right (`/app/receive`, the claim flow, onboarding). It says what signing
 * in is for and points at `/signin`; the terms control and the email and code steps
 * all live there, so no sentence about them belongs here.
 *
 * The body names the reason rather than the mechanism — an account holds the
 * balance and the name people pay you at — in the app's plain, second-person voice,
 * and it makes no claim about where money is kept.
 */
export const SIGN_IN_CARD_COPY = {
  title: 'Sign in to Seti',
  body: 'Your balance and payments are tied to your account.',
  errorTitle: 'Could not sign in',
} as const;
