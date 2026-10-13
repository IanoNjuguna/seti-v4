import { setAuthToken } from '@/lib/api';
import { clearStoredSession, readStoredSession } from './auth.storage';
import { fetchCurrentUser } from './session';
import {
  describeStoredSessionFailure,
  describeStoredSessionMismatch,
  isSameAccount,
} from './session-identity';
import type { AuthUser } from './auth.types';

/**
 * What a load resolved to, before React is involved.
 *
 *  - `anonymous` — nothing stored, or nothing complete stored.
 *  - `restored` — the server confirmed the token and said who it is. `user` is
 *                 the SERVER's copy, never the one that was stored.
 *  - `rejected` — the pair did not survive re-resolution (mismatch, or the server
 *                 refused the token). The stored pair is already gone.
 */
export type SessionBootstrap =
  | { kind: 'anonymous' }
  | { kind: 'restored'; user: AuthUser; token: string }
  | { kind: 'rejected'; error: string };

/**
 * Re-resolve the persisted session against the server, on every load.
 *
 * The stored user is NEVER adopted as an identity. It is presented to the server
 * only as a claim to be checked: the token is installed on the API client and
 * `GET /auth/me` answers with the account the token belongs to, using the same
 * auth middleware the rest of the API uses.
 *
 * Failures are closed, both ways:
 *
 *  - the server refuses the token (401, or unreachable) → the pair is cleared;
 *  - the server resolves a DIFFERENT account than the stored user claims → the
 *    pair is cleared too, because a token and a snapshot that disagree are not a
 *    session, and half-trusting them is exactly the bug this replaces.
 *
 * Only a confirmed match is `restored`, and even then the user returned is the
 * server's account, so what the app displays is always what the server said.
 */
export async function bootstrapStoredSession(): Promise<SessionBootstrap> {
  const stored = readStoredSession();
  if (!stored) return { kind: 'anonymous' };

  // Install the token before asking: the request must carry the credential being
  // checked, not some other one the client happens to hold.
  setAuthToken(stored.token);

  try {
    const resolved = await fetchCurrentUser();

    if (!isSameAccount(stored.user, resolved)) {
      clearStoredSession();
      setAuthToken(null);
      return { kind: 'rejected', error: describeStoredSessionMismatch(stored.user, resolved) };
    }

    return { kind: 'restored', user: resolved, token: stored.token };
  } catch (cause) {
    clearStoredSession();
    setAuthToken(null);
    return { kind: 'rejected', error: describeStoredSessionFailure(cause) };
  }
}
