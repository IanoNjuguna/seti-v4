'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { setAuthToken } from '@/lib/api';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, describeDevSignInFailure, resolveAuthSource } from './auth.constants';
import { devSignIn } from './session';
import type { AuthUser, SessionValue } from './auth.types';

interface StoredSession {
  user: AuthUser;
  token: string;
}

interface SessionState extends StoredSession {
  status: SessionValue['status'];
  error: string | null;
}

const INITIAL: SessionState = {
  status: 'loading',
  user: null as unknown as AuthUser,
  token: null as unknown as string,
  error: null,
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Reads the persisted session.
 *
 * Async on purpose: it keeps every setState in the caller inside a callback
 * rather than synchronously in an effect body, which this app's lint rules
 * reject (`react-hooks/set-state-in-effect`) — and it is the right shape for a
 * store that is not guaranteed to be synchronous.
 */
async function readStoredSession(): Promise<StoredSession | null> {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw || !token) return null;

    return { user: JSON.parse(raw) as AuthUser, token };
  } catch {
    // Unparseable or unavailable storage means "no session", never a crash.
    return null;
  }
}

function persist(session: StoredSession): void {
  try {
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
    window.localStorage.setItem(AUTH_TOKEN_KEY, session.token);
  } catch {
    // Private-mode storage failures must not block sign-in; the session then
    // simply does not survive a reload.
  }
}

function clear(): void {
  try {
    window.localStorage.removeItem(AUTH_USER_KEY);
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Nothing to do; the in-memory session is cleared regardless.
  }
}

/**
 * The web counterpart of `mobile/src/contexts/AuthContext.tsx`.
 *
 * Same shape and same backend endpoints, plus a named source, because a browser
 * has two ways in:
 *
 *  - `dev`   — `POST /auth/dev`, which the backend only serves with
 *              `DEV_BYPASS_AUTH=true` and `NODE_ENV=development`.
 *  - `privy` — the product path: email OTP, then exchange the access token at
 *              `POST /auth/verify`. Requires `NEXT_PUBLIC_PRIVY_APP_ID` and the
 *              `@privy-io/react-auth` provider, neither of which is wired yet —
 *              `signIn` reports exactly that instead of failing silently.
 *
 * Mobile re-verifies its stored token on every cold start. This does not: the
 * backend verifies the token on every request anyway, so a stale session
 * surfaces as a 401 on the first call rather than as an extra round-trip here.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(INITIAL);
  const [signingIn, setSigningIn] = useState(false);
  const { source, configured } = useMemo(() => resolveAuthSource(), []);

  useEffect(() => {
    let active = true;

    void readStoredSession().then((stored) => {
      if (!active) return;

      if (stored) {
        setAuthToken(stored.token);
        setState({ ...stored, status: 'authenticated', error: null });
      } else {
        setState({ ...INITIAL, status: 'anonymous' });
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    if (source === 'privy') {
      setState((previous) => ({
        ...previous,
        error: configured
          ? 'Privy sign-in is not wired yet on the web.'
          : 'Set NEXT_PUBLIC_PRIVY_APP_ID to enable sign-in.',
      }));
      return;
    }

    try {
      setSigningIn(true);
      const { user, token } = await devSignIn();
      persist({ user, token });
      setAuthToken(token);
      setState({ user, token, status: 'authenticated', error: null });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        status: 'anonymous',
        error: describeDevSignInFailure(error),
      }));
    } finally {
      setSigningIn(false);
    }
  }, [source, configured]);

  /**
   * Adopt an already-verified session (the Privy path). Persisting and switching
   * the API token is the whole job — the caller proved the identity.
   */
  const signInWithSession = useCallback((session: { user: AuthUser; token: string }) => {
    persist(session);
    setAuthToken(session.token);
    setState({ ...session, status: 'authenticated', error: null });
  }, []);

  const signOut = useCallback(async () => {
    clear();
    setAuthToken(null);
    setState({ ...INITIAL, status: 'anonymous' });
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user: state.status === 'authenticated' ? state.user : null,
      token: state.status === 'authenticated' ? state.token : null,
      status: state.status,
      isAuthenticated: state.status === 'authenticated',
      source,
      error: state.error,
      signingIn,
      signIn,
      signInWithSession,
      signOut,
    }),
    [state, source, signingIn, signIn, signInWithSession, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
