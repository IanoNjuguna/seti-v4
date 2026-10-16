import type { AuthSource } from './auth.types';
import { ApiError, refusalMessage } from '@/lib/api';

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
 *
 * The cause is read from the STATUS, not from the response's text: the server's
 * sentence is written for a log, and this used to prefix it onto the message a
 * customer reads. The sentence below is ours, and the two failure modes it names
 * are developer-facing, which is what the `dev` source is for.
 */
export function describeDevSignInFailure(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return (
      'Sign-in failed: the backend is not serving POST /auth/dev. Either ' +
      'DEV_BYPASS_AUTH=true and NODE_ENV=development are unset, or the backend ' +
      'process started before they were — it reads .env once at boot, so restart it.'
    );
  }

  return 'Sign-in failed. Try again.';
}

/**
 * Which step of the Privy flow failed. It decides the FALLBACK sentence, and nothing
 * else — the two config failures below are recognised on every step.
 *
 *  - `session` — sending the code, reading the token, or the exchange with
 *    `POST /auth/verify`. Anything unrecognised here gets the shared calm account
 *    line, which offers a retry because re-pressing sign-in is a real next step.
 *  - `code`    — consuming the one-time code. A failure here is the CODE being
 *    refused (mistyped, expired, already used), and the shared account line ("nothing
 *    was changed") is a reassurance about money this flow never moved. So this step
 *    names its own sentence.
 */
export type PrivyFailureStep = 'session' | 'code';

/**
 * The one sentence for a code that was refused.
 *
 * It names the two things the visitor can do — check the code, or have a new one sent
 * — and both controls are already on the screen under it: the code field and the
 * submit button ARE the retry, and "send a new code" is the exact label of the panel's
 * own re-send control. It is plain, second person, and claims nothing about money.
 */
const CODE_REFUSED = 'That code was not right. Check it and try again, or send a new code.';

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
 *
 * The causes are matched on the error's own text (this one comes from the Privy
 * SDK, not from our API) but never INTERPOLATED: a customer gets a sentence
 * telling them what to do, and where the fix is a dashboard they are told which
 * one.
 *
 * A failure that is OURS (`ApiError`) always keeps its mapped sentence
 * (`lib/api/refusal.constants.ts`), so a real reason is never replaced by a flow's
 * generic one. Everything else falls back to `step`.
 */
export function describePrivySignInFailure(
  error: unknown,
  step: PrivyFailureStep = 'session'
): string {
  const text = error instanceof Error ? error.message : '';

  if (/invalid_origin|origin/i.test(text)) {
    return (
      'Sign-in failed: this site’s origin is not on the app id’s allowed origins. ' +
      'Add it in the Privy dashboard (Settings → Domains), then try again.'
    );
  }

  // Matched on the STATUS as well as the text, because the text branch alone can
  // never fire for OUR backend's 503: the API client replaces the server's
  // sentence with its own (`ApiError.message`, see `lib/api/client.ts`), so
  // "not configured" never reaches `error.message`. Only the status survives.
  if ((error instanceof ApiError && error.status === 503) || /503|not configured/i.test(text)) {
    return (
      'Sign-in failed: the backend cannot verify Privy tokens. Set PRIVY_APP_ID and ' +
      'PRIVY_APP_SECRET in backend/.env, using the same app as ' +
      'NEXT_PUBLIC_PRIVY_APP_ID, then restart it and try again.'
    );
  }

  if (error instanceof ApiError) return refusalMessage(error, 'account');

  return step === 'code' ? CODE_REFUSED : refusalMessage(error, 'account');
}
