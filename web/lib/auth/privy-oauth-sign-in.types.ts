/**
 * Google sign-in is a REDIRECT, and that single fact shapes this whole driver.
 *
 * Privy's headless `initOAuth` is documented as resolving when "the redirect (using
 * `window.assign`) is complete", not when the customer has authenticated. So there is
 * no callback to hang the token exchange on: the page leaves, Google authenticates,
 * Privy brings the browser back, and the app boots again as a fresh document.
 *
 * What survives that round trip is a marker in `sessionStorage` (per tab, so a second
 * tab is not dragged into a login it did not start). On boot the session provider asks
 * this driver whether a return is pending, and if it is, completes the SAME
 * `POST /auth/verify` exchange the emailed code ends in. The marker is cleared before
 * the exchange runs, so a failure cannot leave the next page load retrying a session
 * nobody started.
 */

export interface PrivyOAuthSignIn {
  /**
   * Start the Google redirect.
   *
   * Rejects if the flow cannot be started at all (no Privy app, or Privy refusing the
   * provider). Resolves when the browser is navigating away with the request.
   */
  startGoogleLogin: () => Promise<void>;
  /** True when this tab started a Google login and the return has not been collected. */
  hasPendingReturn: () => boolean;
  /** Drop the marker. Called once the return has been handled, or abandoned. */
  clearReturn: () => void;
}
