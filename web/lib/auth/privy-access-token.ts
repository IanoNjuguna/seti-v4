/**
 * Reading the Privy access token reliably.
 *
 * `usePrivy().authenticated` flips true slightly BEFORE the access token is
 * readable, so asking once and giving up turns a timing race into a hard
 * "signed in but no token" failure. Poll briefly instead.
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
