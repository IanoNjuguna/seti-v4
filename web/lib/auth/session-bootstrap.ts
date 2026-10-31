import { ApiError, setAuthToken } from '@/lib/api';
import { clearStoredSession, readStoredSession } from './auth.storage';
import { fetchCurrentUser } from './session';
import { isSameAccount } from './session-identity';
import { SESSION_ENDED, SESSION_UNREACHABLE } from './session-problem.constants';
import type { AuthUser, SessionProblem } from './auth.types';

/**
 * What a load resolved to, before React is involved.
 *
 *  - `anonymous` — nothing stored, or nothing complete stored.
 *  - `restored` — the server confirmed the token and said who it is. `user` is
 *                 the SERVER's copy, never the one that was stored.
 *  - `rejected` — the pair did not survive re-resolution. `problem` is what the
 *                 UI says; the stored pair is gone only when the server REFUSED
 *                 the token, not when it failed to answer.
 */
export type SessionBootstrap =
  | { kind: 'anonymous' }
  | { kind: 'restored'; user: AuthUser; token: string }
  | { kind: 'rejected'; problem: SessionProblem };

/**
 * How long to wait before asking a second time, when the first failure was not
 * about the token.
 *
 * One retry, and only for the not-refused case. A backend restart or a Worker
 * rollout drops a request or two, and asking again once is the difference between
 * a brief pause and telling somebody their session is over when it is not. It is
 * deliberately NOT a loop: the bootstrap runs on mount, and a page that retries
 * for thirty seconds is a page that hangs where a sentence would have done.
 */
const RETRY_DELAY_MS = 600;

/**
 * Is this failure evidence that the token is bad, or evidence of nothing?
 *
 * Only a 401 or a 403 is an answer about the token. Everything else — the API
 * client could not reach the server (`status: 0`), a 5xx, a proxy's HTML error
 * page, or something thrown that is not an `ApiError` at all — says nothing about
 * whether the stored session is still good, and must not be allowed to destroy it.
 *
 * That distinction is the whole fix (#284). Before it, any throw cleared the stored
 * pair, so every deploy, every tunnel restart and every offline moment signed out
 * every signed-in person and sent them back through an emailed code they did not
 * need.
 */
function wasRefused(cause: unknown): boolean {
  return cause instanceof ApiError && (cause.status === 401 || cause.status === 403);
}

/** Ask the server who this token is, once more if the first answer was not one. */
async function resolveWithRetry(): Promise<AuthUser> {
  try {
    return await fetchCurrentUser();
  } catch (cause) {
    if (wasRefused(cause)) throw cause;

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetchCurrentUser();
  }
}

/**
 * Re-resolve the persisted session against the server, on every load.
 *
 * The stored user is NEVER adopted as an identity. It is presented to the server
 * only as a claim to be checked: the token is installed on the API client and
 * `GET /auth/me` answers with the account the token belongs to, using the same
 * auth middleware the rest of the API uses.
 *
 * Failures are closed, both ways, but they are NOT the same event and they do not
 * leave the same thing behind:
 *
 *  - the server REFUSES the token (401/403) → the pair is cleared and the copy is
 *    `SESSION_ENDED`: the session is over, and signing in again is the only thing
 *    that works;
 *  - the server did not ANSWER (unreachable, 5xx, an unreadable body) → the pair is
 *    KEPT and the copy is `SESSION_UNREACHABLE`. Deleting a session because a proxy
 *    hiccuped is a logout nobody asked for, and the stored pair is what restores
 *    the person, with no email code, on the next load;
 *  - the server resolves a DIFFERENT account than the stored user claims → the pair
 *    is cleared too, because a token and a snapshot that disagree are not a
 *    session, and half-trusting them is exactly the bug this replaces.
 *
 * Only a confirmed match is `restored`, and even then the user returned is the
 * server's account, so what the app displays is always what the server said.
 *
 * The token is removed from the API client on EVERY failure, while the stored copy
 * survives the transient one. Those are two different acts: a client holding a
 * credential nothing has confirmed is what the next request would ride on, and
 * storage is only where the next load picks the claim up again.
 */
export async function bootstrapStoredSession(): Promise<SessionBootstrap> {
  const stored = readStoredSession();
  if (!stored) return { kind: 'anonymous' };

  // Install the token before asking: the request must carry the credential being
  // checked, not some other one the client happens to hold.
  setAuthToken(stored.token);

  try {
    const resolved = await resolveWithRetry();

    if (!isSameAccount(stored.user, resolved)) {
      clearStoredSession();
      setAuthToken(null);
      return { kind: 'rejected', problem: SESSION_ENDED };
    }

    return { kind: 'restored', user: resolved, token: stored.token };
  } catch (cause) {
    setAuthToken(null);

    if (!wasRefused(cause)) {
      return { kind: 'rejected', problem: SESSION_UNREACHABLE };
    }

    clearStoredSession();
    return { kind: 'rejected', problem: SESSION_ENDED };
  }
}
