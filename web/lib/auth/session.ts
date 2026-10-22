import { get, post } from '@/lib/api';
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
 *
 * `acceptedTermsVersion` is the terms version this browser displayed and had
 * accepted. It is the client's CLAIM about what it showed: the backend records its
 * own version on the new account's audit row and refuses the sign-up if the two
 * disagree, so a stale build cannot have a version it never displayed written down
 * as accepted.
 */
export async function verifyPrivyToken(
  token: string,
  walletAddress?: string,
  acceptedTermsVersion?: string,
  referralCode?: string | null
): Promise<AuthUser> {
  const { user } = await post<VerifyResponse>('/auth/verify', {
    token,
    walletAddress,
    acceptedTermsVersion,
    // Omitted rather than sent as `null` when there is none: the field means "this
    // browser arrived on an invite", and an absent one is the ordinary case.
    referralCode: referralCode ?? undefined,
  });
  return user;
}

/**
 * Ask the server who the CURRENT bearer token belongs to.
 *
 * This is the re-resolution the web session runs on every load. The client holds
 * a token and a user it remembers; only `GET /auth/me` can say whether those two
 * still agree, because the server verifies the token through the same middleware
 * every other route uses. Nothing about the remembered user is sent — the token
 * alone is the claim, and the server's answer is the only identity the app adopts.
 *
 * It carries whatever token the API client currently holds (see
 * `setAuthToken`/`setTokenProvider`), so the caller must install the token first.
 */
export async function fetchCurrentUser(): Promise<AuthUser> {
  const { user } = await get<VerifyResponse>('/auth/me');
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
  walletAddress?: string,
  acceptedTermsVersion?: string,
  referralCode?: string | null
): Promise<{ user: AuthUser; token: string }> {
  const user = await verifyPrivyToken(
    privyAccessToken,
    walletAddress,
    acceptedTermsVersion,
    referralCode
  );
  return { user, token: privyAccessToken };
}
