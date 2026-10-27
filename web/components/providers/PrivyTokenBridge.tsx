'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useRef, type ReactNode } from 'react';
import { setTokenProvider } from '@/lib/api';

/**
 * Keeps the API client supplied with a fresh Privy access token — and only when
 * the SDK says there is a session to take one from.
 *
 * An access token lives an hour, and Privy deliberately does not let a server
 * refresh one — only the browser can, and only when asked. So the client asks for
 * a token per request via this bridge instead of holding the one it got at sign-in.
 * `getAccessToken()` refreshes when the token is near expiry and returns one that
 * is valid at the moment it is returned.
 *
 * ## Why every read is behind `authenticated` (#252)
 *
 * `getAccessToken()` is not a read. Privy's own typing says that when it finds no
 * valid token it will **force a logout** and return null. This bridge is asked on
 * EVERY API request (`lib/api/client.ts` → `resolveToken`), and on a page reload
 * the first of those requests lands before the SDK has restored its session from
 * storage — exactly the moment a read is most likely to come back empty and take
 * the refresh token with it.
 *
 * So the provider refuses to ask the SDK anything until `authenticated` is true.
 * A boot-time request made before the session is restored now gets `null` — which
 * `resolveToken` already treats as "fall back to the stored token" — instead of a
 * force-logout. Losing one request's freshness is recoverable; revoking the session
 * is not.
 *
 * ## What this guard is NOT
 *
 * Measured, it is not what revoked the session on reload. With this guard in place
 * and every read blocked — seven provider calls, all `authenticated=false`, not one
 * `getAccessToken()` — a reload still produced `POST /sessions` 200 → six
 * `GET /users/:id/wallets` 200 → `POST /sessions/logout` 200. The revocation came
 * from the SDK's own hydration checking the app's terms requirement, and it is
 * fixed where the acceptance is recorded (`lib/auth/privy-email-sign-in.ts`).
 * This guard stays because it removes the OTHER revoke path #252 names, so that no
 * boot-time read can end a session even if the terms path regresses.
 *
 * `authenticated` is read through a ref because the provider closure is installed
 * once into the API client and outlives the render that created it: a direct
 * capture would be stale the moment the reload finished restoring the session, and
 * no request would ever see a fresh token again.
 *
 * Mounted only inside `PrivyProvider`, so `usePrivy` always has a provider above it.
 */
export function PrivyTokenBridge({ children }: { children: ReactNode }) {
  const { getAccessToken, authenticated } = usePrivy();

  // Seeded from the current render, then kept current by the effect below, so the
  // provider closure reads today's value rather than the one it was installed with.
  // The seed is deliberately the CURRENT value: if the effect has not run yet the
  // closure answers `null`, which falls back to the stored token. Being briefly
  // stale towards `false` costs a fresh token; being stale towards `true` would ask
  // the SDK for a token it does not have, which is the force-logout.
  const authenticatedRef = useRef(authenticated);
  useEffect(() => {
    authenticatedRef.current = authenticated;
  }, [authenticated]);

  useEffect(() => {
    setTokenProvider(async () =>
      authenticatedRef.current ? getAccessToken() : null
    );

    return () => {
      setTokenProvider(null);
    };
  }, [getAccessToken]);

  return <>{children}</>;
}
