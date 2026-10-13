'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { setAuthToken } from '@/lib/api';
import { describeDevSignInFailure, resolveAuthSource } from './auth.constants';
import { clearStoredSession, persistSession, type StoredSession } from './auth.storage';
import { bootstrapStoredSession } from './session-bootstrap';
import { devSignIn } from './session';
import type { AuthUser, SessionValue } from './auth.types';

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
 * The web counterpart of `mobile/src/contexts/AuthContext.tsx`.
 *
 * Same shape and same backend endpoints, plus a named source, because a browser
 * has two ways in:
 *
 *  - `dev`   — `POST /auth/dev`, which the backend only serves with
 *              `DEV_BYPASS_AUTH=true` and `NODE_ENV=development`.
 *  - `privy` — the product path: email OTP, then exchange the access token at
 *              `POST /auth/verify`. Requires `NEXT_PUBLIC_PRIVY_APP_ID` and the
 *              `@privy-io/react-auth` provider.
 *
 * The session is RE-RESOLVED on every load, not read from storage as a fact. The
 * browser keeps a token and a user it remembers, but a remembered identity is not
 * proof of anything — it can be stale, or edited to name an account the token does
 * not own. So `bootstrapStoredSession()` presents the token to `GET /auth/me` and
 * adopts only what the server answers with; a token the server refuses, or an
 * answer that names a different account than the stored user claimed, clears the
 * stored pair and leaves the app signed out. See `session-bootstrap.ts`.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(INITIAL);
  const [signingIn, setSigningIn] = useState(false);
  const { source, configured } = useMemo(() => resolveAuthSource(), []);

  // State is written only from the promise callback, never synchronously in the
  // effect body: `react-hooks/set-state-in-effect` is an error in this package.
  useEffect(() => {
    let active = true;

    void bootstrapStoredSession().then((outcome) => {
      if (!active) return;

      if (outcome.kind === 'restored') {
        // Persist the SERVER's copy, not the one that was there at load: the
        // snapshot is refreshed from the confirmed answer every time.
        persistSession({ user: outcome.user, token: outcome.token });
        setState({
          user: outcome.user,
          token: outcome.token,
          status: 'authenticated',
          error: null,
        });
        return;
      }

      setState({
        ...INITIAL,
        status: 'anonymous',
        // A rejected pair is reported, because being signed out with no
        // explanation is indistinguishable from a broken app. A first visit
        // (`anonymous`) is silent — there was never a session to lose.
        error: outcome.kind === 'rejected' ? outcome.error : null,
      });
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
      persistSession({ user, token });
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
    persistSession(session);
    setAuthToken(session.token);
    setState({ ...session, status: 'authenticated', error: null });
  }, []);

  const signOut = useCallback(async () => {
    clearStoredSession();
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
