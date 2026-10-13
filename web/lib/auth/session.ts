import { post } from '@/lib/api';
import type { AuthUser } from './auth.types';

interface VerifyResponse {
  user: AuthUser;
}

interface DevResponse {
  user: AuthUser;
  token: string;
}

/**
 * Exchange a Privy access token for the local Seti user.
 *
 * Identical to the mobile app's exchange (`mobile/src/contexts/AuthContext.tsx`)
 * because it is the same backend endpoint: the token is verified server-side and
 * the local user is upserted, so the browser never asserts its own identity.
 *
 * `walletAddress` is the exception, and it is not an identity claim: the browser
 * names the embedded wallet it will SIGN WITH, and the backend checks that address
 * against Privy's own wallet list for this user before registering it. Only the
 * browser knows which of a user's wallets `useWallets()` picked, and registering a
 * different one is how a funded account came to read a balance of zero.
 */
export async function verifyPrivyToken(
  token: string,
  walletAddress?: string
): Promise<AuthUser> {
  const { user } = await post<VerifyResponse>('/auth/verify', { token, walletAddress });
  return user;
}

/**
 * Local development sign-in.
 *
 * Requires the backend to be running with `DEV_BYPASS_AUTH=true` and
 * `NODE_ENV=development`; it answers 404 otherwise, by design.
 */
export async function devSignIn(): Promise<{ user: AuthUser; token: string }> {
  return post<DevResponse>('/auth/dev', {});
}

/**
 * Exchange a Privy access token for a Seti session.
 *
 * The Privy access token IS the bearer credential: the backend's auth middleware
 * verifies it directly on every request (`verifyPrivyToken`), so there is no
 * second Seti-issued token to hold. Returns the local user and the token to store.
 *
 * Caveat: a Privy access token expires (about an hour). `PrivyTokenBridge`
 * registers a token provider with the API client, which asks Privy for a fresh
 * token before each request and retries once on a 401 — so a long-lived browser
 * session keeps working. Without that bridge (no `NEXT_PUBLIC_PRIVY_APP_ID`), the
 * stored token is all there is and it dies an hour in.
 */
export async function privySignIn(
  privyAccessToken: string,
  walletAddress?: string
): Promise<{ user: AuthUser; token: string }> {
  const user = await verifyPrivyToken(privyAccessToken, walletAddress);
  return { user, token: privyAccessToken };
}
