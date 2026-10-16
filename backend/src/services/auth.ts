import { PrivyClient } from '@privy-io/server-auth';
import { env } from '../config/env.js';

if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET) {
  // In development we allow the auth service to be missing so the scaffold
  // can run without real Privy credentials. All verify calls will throw.
  console.warn(
    '[auth] PRIVY_APP_ID or PRIVY_APP_SECRET is not set. Privy token verification is disabled.'
  );
}

export const privy =
  env.PRIVY_APP_ID && env.PRIVY_APP_SECRET
    ? new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET)
    : null;

/**
 * The refusal code for a token this server will not accept.
 *
 * `unauthorized` is a code the web app ALREADY knows
 * (`web/lib/api/refusal.constants.ts`): it renders as "Your session has ended.
 * Sign in again to continue." and is deliberately NOT retryable, because
 * presenting the same unverifiable token again fails identically. A new code
 * would render as the unknown-code sentence and offer a Retry button that cannot
 * work, which is why this is reused rather than invented.
 */
export type AuthRefusal = 'unauthorized';
export const AUTH_UNAUTHORIZED: AuthRefusal = 'unauthorized';

/**
 * The sentence that goes with it, wherever the refusal surfaces — the same words
 * the middleware answers a refused bearer token with. It is deliberately NOT the
 * SDK's message: a customer never reads a vendor's phrasing, and the SDK's own
 * words (which name the algorithm, the key, or the app) stay in the server log.
 */
export const AUTH_UNAUTHORIZED_MESSAGE = 'Invalid or expired token';

/**
 * A Privy token this server could not verify: malformed, expired, or refused by
 * Privy (a token minted for a different app lands here too).
 *
 * It is a TYPE rather than a bare `Error` because the two events it separates
 * have different owners and different next steps, and only one of them is the
 * caller's:
 *
 *   - the token is not good            → the caller authenticates again (401);
 *   - the check itself broke           → ours, and possibly retryable (500).
 *
 * A bare throw made them indistinguishable, and `POST /auth/verify` reported the
 * first as the second: a 500 `INTERNAL_ERROR` — "Something went wrong on our
 * side" — for a token that was merely wrong. That sentence blamed Seti for the
 * caller's token and told the person nothing they could act on.
 *
 * `statusCode`/`code` are carried so the shared error handler maps this to the
 * refusal even if a caller forgets to catch it: a 4xx with a typed code passes
 * through untouched, while an untyped throw becomes an `INTERNAL_ERROR`
 * (`apiErrorHandler` in `server.ts`).
 */
export class PrivyTokenVerificationError extends Error {
  readonly statusCode = 401;
  readonly code: AuthRefusal = AUTH_UNAUTHORIZED;
  /** The SDK's own words — for the server log only, never returned to a client. */
  readonly sdkMessage: string;

  constructor(sdkMessage: string, cause: unknown) {
    super(AUTH_UNAUTHORIZED_MESSAGE, { cause });
    this.name = 'PrivyTokenVerificationError';
    this.sdkMessage = sdkMessage;
  }
}

export interface VerifiedUser {
  privyDid: string;
  email?: string;
  phone?: string;
  walletAddress?: string;
  /**
   * Every embedded wallet Privy holds for this user, in Privy's order.
   *
   * A user can have MORE THAN ONE embedded wallet — `createOnLogin` makes one in
   * the browser, and the login route used to mint another server-side when
   * Privy's server view had none to report. The browser then signs with whichever
   * one `useWallets()` lists first, which is not necessarily `wallet`, so login
   * needs the whole set to check a client-declared address against.
   */
  embeddedWalletAddresses: string[];
}

/**
 * Verify a Privy token and return ONLY the subject it was issued for.
 *
 * The middleware's whole job is to answer "who is this?" and the answer Privy
 * gives is the token's subject — the DID. The token is fixed at issuance, so the
 * subject is the identity the session was ESTABLISHED with; it does not drift the
 * way a fetched profile does. Deliberately no `getUserById`: that call re-reads
 * live profile attributes (email, wallets) on every request, which is the
 * re-resolution the session-identity snapshot removes. The account is resolved
 * from the subject by `resolveSessionIdentity`, not from a profile fetched now.
 */
export async function verifyPrivySubject(token: string): Promise<string> {
  const claims = await privyClaims(token);
  return claims.userId;
}

/**
 * Verify a Privy token, or throw the typed refusal it earns.
 *
 * Extracted so `verifyPrivyToken` (login, which needs the whole profile) and
 * `verifyPrivySubject` (the middleware, which needs only the subject) fail and
 * log identically — a second copy of this catch would be a second place to get
 * the diagnosis wrong.
 *
 * Only a verification failure is a refusal. The `!privy` branch below is NOT:
 * with no client nothing was ever checked, and env.ts refuses to boot a
 * production process in that state. It stays a plain `Error` — a deployment
 * fault — so it cannot be answered as "your token is bad".
 */
async function privyClaims(token: string) {
  if (!privy) {
    throw new Error('Privy is not configured. Set PRIVY_APP_ID and PRIVY_APP_SECRET.');
  }

  try {
    return await privy.verifyAuthToken(token);
  } catch (cause) {
    // Do not collapse every cause into "Invalid or expired auth token". A network
    // fault while fetching the app's verification key, or a token minted for a
    // different app, arrive here too — and under the flat message they were
    // indistinguishable from a genuinely bad token, which sent a debugging
    // session after the wrong thing. Log the full cause (including undici's
    // hidden `.cause`); report the SDK's own message to the log, never to the
    // caller (the thrown refusal carries the authored sentence instead).
    const e = cause as Error & { cause?: { message?: string; code?: string } };
    const inner = e.cause?.message ?? e.cause?.code ?? '';

    // `console.error`, matching this file's existing console.warn for the
    // missing-credentials case: this function has no request/logger in scope, and
    // the cause (undici hides the real network reason in `.cause`) matters more
    // than the channel. This line is what tells a rejected token apart from
    // Privy being unreachable; both are answered with the same 401.
    console.error(
      '[auth] Privy token verification failed:',
      e.message,
      inner ? `| cause: ${inner}` : ''
    );

    throw new PrivyTokenVerificationError(e.message, cause);
  }
}

export async function verifyPrivyToken(token: string): Promise<VerifiedUser> {
  const claims = await privyClaims(token);

  const user = await privy!.getUserById(claims.userId);

  const email = user.email?.address;
  const phone = user.phone?.number;
  const walletAddress = user.wallet?.address;

  // Every address-bearing linked account, then the embedded ones specifically:
  // `walletClientType === 'privy'` is what marks a wallet this app created, as
  // opposed to an external one the user connected. Falling back to any linked
  // wallet keeps an app configured without the field working rather than
  // silently reporting zero wallets.
  const linked = (user.linkedAccounts ?? []) as Array<{
    type?: string;
    address?: string;
    walletClientType?: string;
  }>;
  const withAddress = linked.filter((account) => typeof account.address === 'string');
  const embedded = withAddress.filter((account) => account.walletClientType === 'privy');
  const embeddedWalletAddresses = (embedded.length > 0 ? embedded : withAddress)
    .filter((account) => account.type === 'wallet' || embedded.length > 0)
    .map((account) => account.address as string);

  return {
    privyDid: claims.userId,
    email,
    phone,
    walletAddress,
    embeddedWalletAddresses,
  };
}

export function isPrivyConfigured(): boolean {
  return privy !== null;
}
