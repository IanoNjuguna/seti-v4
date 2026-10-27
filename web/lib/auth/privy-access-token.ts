/**
 * Reading the Privy access token reliably.
 *
 * `usePrivy().authenticated` flips true slightly BEFORE the access token is
 * readable, so asking once and giving up turns a timing race into a hard
 * "signed in but no token" failure. Poll briefly instead.
 *
 * ## The check is BEFORE each attempt, not after the loop (#252)
 *
 * `getAccessToken()` is not a read. Privy's typing says that when it finds no
 * valid token it will **force a logout** and return null. Retrying it while the
 * SDK has no session therefore does not merely fail six times — each attempt is
 * another chance to revoke the refresh token, and the session is gone server-side
 * by the second try. Noticing a sign-out only after the loop is noticing after the
 * damage: every attempt is guarded, so a retry can never be issued on an
 * unauthenticated SDK.
 *
 * Kept out of the component so the retry policy is testable and the component
 * stays a thin list of states.
 */
const TOKEN_ATTEMPTS = 6;
const TOKEN_RETRY_MS = 400;

export async function readPrivyAccessToken(
  getAccessToken: () => Promise<string | null>,
  isStillSignedIn: () => boolean
): Promise<string | null> {
  for (let attempt = 0; attempt < TOKEN_ATTEMPTS; attempt += 1) {
    // Before every attempt, not after the last one: a read on an unauthenticated
    // SDK is the force-logout itself.
    if (!isStillSignedIn()) return null;

    const token = await getAccessToken();
    if (token) return token;

    await new Promise((resolve) => setTimeout(resolve, TOKEN_RETRY_MS));
  }

  // No token *and* no longer signed in is a sign-out racing this exchange, not a
  // failure. Throwing here would flash "could not sign in" at someone who had
  // just deliberately signed out.
  if (!isStillSignedIn()) return null;

  throw new Error('Privy signed in but never returned an access token.');
}
