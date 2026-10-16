import type { AuthStatus } from '@/lib/auth';

/**
 * The two session states in which there is NO account behind the screen — the
 * states a demo visitor lives in.
 *
 * Derived from the session hook's own union rather than spelled out again, and
 * deliberately NOT the whole of it: a component that renders "nothing to show"
 * cannot be handed the one state that HAS something to show. `restoring` is in
 * here because a restore that has not answered is not an account, and the app
 * renders through it rather than blanking.
 */
export type NoIdentityView = Exclude<AuthStatus, 'signed-in'>;

/**
 * What a signed-out sentence is about.
 *
 * A closed union rather than a string, because these sentences are the app's
 * voice for one idea ("there is nothing here because there is no account") and
 * the point of `NO_ACCOUNT_COPY` is that every surface says it the same way.
 * The value is the noun as the CUSTOMER says it — no surface passes a noun of
 * its own invention.
 */
export type NoAccountWhat =
  | 'your balance'
  | 'your activity'
  /**
   * Profile's two facts, added when `/app/profile` stopped being a sign-in wall
   * and became the page's own shape with these sentences where the account's data
   * would be. Both are the noun as the customer says it, and both read as the
   * sentence the voice builds: "Sign in to see your name." / "Sign in to see which
   * network you are on."
   */
  | 'your name'
  | 'which network you are on';
