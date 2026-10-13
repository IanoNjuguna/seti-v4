'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describePrivySignInFailure, useSession } from '@/lib/auth';
import { privySignIn } from '@/lib/auth/session';
import { readPrivyAccessToken } from '@/lib/auth/privy-access-token';
import { useEmbeddedWallet } from './useEmbeddedWallet';
import type { PrivyExchangeValue } from './usePrivySessionExchange.types';

/**
 * Exchange a Privy session for a Seti one, and report where that got to.
 *
 * Two things this deliberately does not do:
 *
 * 1. **It never re-fires after a failure.** A recorded error stops the effect, so
 *    a broken exchange cannot become a retry loop; recovery is an explicit retry.
 * 2. **It treats a vanished session as success.** If a sign-out lands while the
 *    access token is still being read, there is nothing to exchange — reporting
 *    that as an error would flash "could not sign in" at someone who just signed
 *    out on purpose.
 */
export function usePrivySessionExchange(): PrivyExchangeValue {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { isAuthenticated, signInWithSession } = useSession();
  const { address } = useEmbeddedWallet();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Lets a long token wait ask "is this still wanted?" at the moment it finishes,
  // instead of trusting the value captured when it began.
  const authenticatedRef = useRef(authenticated);
  useEffect(() => {
    authenticatedRef.current = authenticated;
  }, [authenticated]);

  // Read through a ref so a wallet that arrives *after* the exchange starts does
  // not re-run it: the backend falls back to Privy's own view when the address is
  // absent, and the next sign-in declares it.
  const addressRef = useRef(address);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  const exchange = useCallback(async () => {
    const token = await readPrivyAccessToken(getAccessToken, () => authenticatedRef.current);
    if (!token) return;

    const { user, token: sessionToken } = await privySignIn(token, addressRef.current ?? undefined);
    signInWithSession({ user, token: sessionToken });
  }, [getAccessToken, signInWithSession]);

  // State is written only from the promise callbacks, never in the effect body:
  // `react-hooks/set-state-in-effect` is an error in this package.
  useEffect(() => {
    if (!ready || !authenticated || isAuthenticated || error) return;

    let active = true;
    exchange().catch((cause: unknown) => {
      if (active) setError(describePrivySignInFailure(cause));
    });

    return () => {
      active = false;
    };
  }, [ready, authenticated, isAuthenticated, exchange, error, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((previous) => previous + 1);
  }, []);

  const status: PrivyExchangeValue['status'] = error
    ? 'failed'
    : authenticated && !isAuthenticated
      ? 'exchanging'
      : 'idle';

  return { status, error, retry };
}
