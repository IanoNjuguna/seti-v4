import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from './auth.constants';
import type { AuthUser } from './auth.types';

/**
 * The pair the browser keeps between loads: a token, and who it *says* it is.
 *
 * The user half is only ever a cache. It is written from a server response and
 * is re-checked against the server on every load (`session-bootstrap.ts`) — it is
 * never read as a fact on its own.
 */
export interface StoredSession {
  user: AuthUser;
  token: string;
}

/**
 * Read the persisted session, or null when there is not a complete one.
 *
 * Synchronous on purpose: every caller is already inside an async function, and
 * a storage read has no business pretending to be a network call. Unparseable or
 * unavailable storage means "no session", never a crash.
 */
export function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw || !token) return null;

    return { user: JSON.parse(raw) as AuthUser, token };
  } catch {
    return null;
  }
}

/**
 * Persist a session the server has just confirmed.
 *
 * Both halves are written together or not at all in effect: a half-write (a
 * user with no token, a token with no user) reads back as "no session", which is
 * the safe direction. A private-mode failure must not block sign-in; the session
 * then simply does not survive a reload.
 */
export function persistSession(session: StoredSession): void {
  try {
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
    window.localStorage.setItem(AUTH_TOKEN_KEY, session.token);
  } catch {
    // Nothing to do — the in-memory session is what the app runs on.
  }
}

/**
 * Drop both halves.
 *
 * Called on sign-out AND whenever the stored pair fails to re-resolve, so a
 * token the server has refused can never leave a cached identity behind for the
 * next load to pick up.
 */
export function clearStoredSession(): void {
  try {
    window.localStorage.removeItem(AUTH_USER_KEY);
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Nothing to do; the in-memory session is cleared by the caller regardless.
  }
}
