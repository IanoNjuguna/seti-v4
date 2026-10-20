'use client';

import { useCallback, useMemo } from 'react';
import { useLoginWithOAuth } from '@privy-io/react-auth';
import { PRIVY_APP_ID } from '@/components/providers/PrivyAppProvider.constants';
import type { PrivyOAuthSignIn } from './privy-oauth-sign-in.types';

/**
 * Where the pending-return marker lives.
 *
 * `sessionStorage` and not `localStorage`: it is scoped to the tab, so starting a
 * Google login in one tab cannot make a different tab try to finish it. Access is
 * wrapped because storage throws in a private window on some browsers, and a sign-in
 * that dies on a storage exception is a worse failure than one that cannot remember
 * it was in progress.
 */
const PENDING_RETURN_KEY = 'seti-oauth-pending';

function readMarker(): boolean {
  try {
    return window.sessionStorage.getItem(PENDING_RETURN_KEY) === 'google';
  } catch {
    return false;
  }
}

function writeMarker(): void {
  try {
    window.sessionStorage.setItem(PENDING_RETURN_KEY, 'google');
  } catch {
    // No storage: the return will land on `/signin` as an anonymous visitor, which is
    // the same place a cancelled login lands. Annoying, never wrong.
  }
}

function dropMarker(): void {
  try {
    window.sessionStorage.removeItem(PENDING_RETURN_KEY);
  } catch {
    // Nothing to drop if nothing could be written.
  }
}

function usePrivyOAuthSignInImpl(): PrivyOAuthSignIn {
  const { initOAuth } = useLoginWithOAuth();

  const startGoogleLogin = useCallback(async () => {
    // The marker goes down FIRST: the redirect is what creates the new document, and
    // anything written after `initOAuth` would be racing the navigation.
    writeMarker();
    try {
      await initOAuth({ provider: 'google' });
    } catch (cause) {
      // Leaving the marker behind would make the next visit try to complete a login
      // that never started.
      dropMarker();
      throw cause;
    }
  }, [initOAuth]);

  const hasPendingReturn = useCallback(() => readMarker(), []);
  const clearReturn = useCallback(() => dropMarker(), []);

  // Memoised so the session provider's boot effect can list this as a dependency
  // without re-running on every render: the effect is what completes a Google return,
  // and re-running it would re-attempt an exchange that has already happened.
  return useMemo(
    () => ({ startGoogleLogin, hasPendingReturn, clearReturn }),
    [startGoogleLogin, hasPendingReturn, clearReturn]
  );
}

/**
 * The no-Privy stand-in.
 *
 * A build with no app id cannot reach Google at all, and the button is not rendered
 * there. It rejects rather than resolving so a caller that reaches it lands in the
 * session's `error` state instead of a `useLoginWithOAuth`-has-no-provider crash, the
 * same rule `usePrivyEmailSignIn` follows.
 */
function usePrivyOAuthSignInNoop(): PrivyOAuthSignIn {
  const startGoogleLogin = useCallback(
    (): Promise<void> =>
      Promise.reject(new Error('Google sign-in is not configured: NEXT_PUBLIC_PRIVY_APP_ID is not set.')),
    []
  );
  const hasPendingReturn = useCallback(() => false, []);
  const clearReturn = useCallback(() => undefined, []);

  return { startGoogleLogin, hasPendingReturn, clearReturn };
}

export const usePrivyOAuthSignIn: () => PrivyOAuthSignIn = PRIVY_APP_ID
  ? usePrivyOAuthSignInImpl
  : usePrivyOAuthSignInNoop;
