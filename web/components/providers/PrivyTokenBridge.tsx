'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect, type ReactNode } from 'react';
import { setTokenProvider } from '@/lib/api';

/**
 * Keeps the API client supplied with a fresh Privy access token.
 *
 * An access token lives an hour, and Privy deliberately does not let a server
 * refresh one — only the browser can, and only when asked. So the client asks for
 * a token per request via this bridge instead of holding the one it got at sign-in.
 * `getAccessToken()` refreshes when the token is near expiry and returns one that
 * is valid at the moment it is returned.
 *
 * Mounted only inside `PrivyProvider`, so `usePrivy` always has a provider above it.
 */
export function PrivyTokenBridge({ children }: { children: ReactNode }) {
  const { getAccessToken } = usePrivy();

  useEffect(() => {
    setTokenProvider(() => getAccessToken());

    return () => {
      setTokenProvider(null);
    };
  }, [getAccessToken]);

  return <>{children}</>;
}
