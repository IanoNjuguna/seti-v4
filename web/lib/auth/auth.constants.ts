import type { AuthSource } from './auth.types';

/** localStorage keys — the web counterpart of mobile's SecureStore entries. */
export const AUTH_TOKEN_KEY = 'seti-auth-token';
export const AUTH_USER_KEY = 'seti-auth-user';

/**
 * Which sign-in path this build uses.
 *
 * `NEXT_PUBLIC_AUTH_SOURCE` wins when set. The default is `privy` if an app id
 * is configured, because that is the product path; otherwise `dev` in
 * development, so a local build can sign in without a Privy dashboard entry.
 * In production with no app id there is nothing to fall back to, and the app
 * correctly reports a configuration error rather than silently going anonymous.
 */
export function resolveAuthSource(): { source: AuthSource; configured: boolean } {
  const explicit = process.env.NEXT_PUBLIC_AUTH_SOURCE;
  const hasPrivy = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

  if (explicit === 'dev' || explicit === 'privy') {
    return { source: explicit, configured: explicit === 'dev' || hasPrivy };
  }

  if (hasPrivy) return { source: 'privy', configured: true };

  return { source: 'dev', configured: process.env.NODE_ENV !== 'production' };
}

/**
 * Turn a dev sign-in failure into something actionable.
 *
 * `POST /auth/dev` answers `404 {"error":"Not found"}` when either gate is off —
 * *and* when the backend process booted before the flag was in `.env`, because
 * `dotenv.config()` reads the file once at boot and `tsx watch` never re-reads
 * it. That second cause is invisible from the client and reads as a missing
 * flag, which is exactly the wrong thing to chase. Name both.
 */
export function describeDevSignInFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'Sign-in failed.';

  if (/not found|404/i.test(error.message)) {
    return (
      `${error.message} — the backend is not serving POST /auth/dev. Either ` +
      'DEV_BYPASS_AUTH=true and NODE_ENV=development are unset, or the backend ' +
      'process started before they were: it reads .env once at boot, so restart it.'
    );
  }

  return error.message;
}

/**
 * Turn a Privy sign-in failure into something actionable.
 *
 * The two failures that look like nothing are both configuration, and both are at
 * the Privy dashboard rather than in this code:
 *
 *  - `invalid_origin` — the web origin is not on the app id's allowed origins.
 *    It presents as a generic network/authorization failure, so it is named here.
 *  - a 503 from `POST /auth/verify` — the backend has no PRIVY_APP_ID/SECRET, so
 *    it cannot verify any token. The browser half can be perfect and sign-in
 *    still cannot complete.
 */
export function describePrivySignInFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Sign-in failed.';

  if (/invalid_origin|origin/i.test(message)) {
    return (
      `${message} — add this origin to the allowed origins for app ` +
      'NEXT_PUBLIC_PRIVY_APP_ID in the Privy dashboard (Settings → Domains).'
    );
  }

  if (/503|not configured/i.test(message)) {
    return (
      `${message} — the backend cannot verify Privy tokens. Set PRIVY_APP_ID and ` +
      'PRIVY_APP_SECRET in backend/.env, using the same app as ' +
      'NEXT_PUBLIC_PRIVY_APP_ID, then restart it.'
    );
  }

  return message;
}
