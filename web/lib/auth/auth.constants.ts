import type { AuthSource } from './auth.types';
import { ApiError, refusalMessage } from '@/lib/api';
import { REFUSAL_NETWORK_STATUS } from '@/lib/api/refusal.constants';
import { SESSION_UNREACHABLE } from './session-problem.constants';

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
 *
 * This is now the sentence for a WRONG DIGIT and nothing else. It used to be every
 * refusal at this step, which is how a correct code came to be called wrong (#515).
 */
const CODE_REFUSED = 'That code was not right. Check it and try again, or send a new code.';

/**
 * A code that is spent rather than mistyped.
 *
 * Privy answers `422 invalid_credentials` for a code that has already been used or has
 * passed its ten minutes, and "check it and try again" is advice that cannot work: the
 * same digits will be refused for ever. The one action that does work is a new code, so
 * that is the whole sentence.
 */
const CODE_SPENT =
  'That code has already been used, or it has expired. Send a new code and enter the one from the newest email.';

/**
 * The browser is still signed in to a DIFFERENT account (#515).
 *
 * Nothing is wrong with the code, and the code was never checked: Privy carries the
 * session this browser still holds into the login, reads the attempt as *linking an
 * email onto the user already signed in*, and refuses it with
 * `cannot_link_more_of_type`. Saying so is the only useful thing to say, because the
 * fix is not in the code field — and the state is real: Seti's session ends long before
 * Privy's does, and the person may never have signed out of the other account at all.
 */
const OTHER_ACCOUNT_SIGNED_IN =
  'This browser is still signed in to a different account, so this code cannot be used here. Sign out of that account, or clear this site’s data, then sign in again.';

/** Privy's own throttle on codes sent and codes tried. */
const TOO_MANY_ATTEMPTS =
  'Too many codes have been sent or tried from here. Wait a few minutes, then send a new code.';

/**
 * What Privy said, read off the error it threw.
 *
 * Every failure out of the SDK is one of its own error classes, and the interesting
 * ones carry `code` (its stable identifier: `cannot_link_more_of_type`,
 * `invalid_credentials`, …) plus, for an API refusal, `status` and the server's own
 * sentence in `message`. Read defensively: this also receives plain `Error`s from the
 * SDK's client-side guards, and a mapping function must never throw on the error it was
 * handed.
 */
function readVendorRefusal(error: unknown): { code?: string; status?: number; message: string } {
  const candidate = error as { code?: unknown; status?: unknown; message?: unknown } | null;

  return {
    code: typeof candidate?.code === 'string' ? candidate.code : undefined,
    status: typeof candidate?.status === 'number' ? candidate.status : undefined,
    message: typeof candidate?.message === 'string' ? candidate.message : '',
  };
}

/**
 * Write the refusal down once, with the vendor's own identifier.
 *
 * Evidence, not silence: a refused sign-in used to leave NOTHING, client or server, so
 * the screenshot was the only artefact and nobody could tell a spent code from a stale
 * session (#515). The person still reads the mapped sentence; this is for whoever is
 * holding the report.
 */
export function logPrivySignInFailure(step: PrivyFailureStep, error: unknown): void {
  const { code, status, message } = readVendorRefusal(error);

  console.error(
    `[auth] Privy refused the sign-in ${step === 'code' ? 'code' : 'session'} step:`,
    { code, status, message }
  );
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
 *
 * The causes are matched on the error's own text (this one comes from the Privy
 * SDK, not from our API) but never INTERPOLATED: a customer gets a sentence
 * telling them what to do, and where the fix is a dashboard they are told which
 * one.
 *
 * A failure that is OURS (`ApiError`) always keeps its mapped sentence
 * (`lib/api/refusal.constants.ts`), so a real reason is never replaced by a flow's
 * generic one. Everything else falls back to `step`.
 *
 * ## The code step is no longer one sentence (#515)
 *
 * A correct, unexpired code was being called wrong because every refusal at this step
 * shared `CODE_REFUSED`. Privy distinguishes these precisely, so this does too:
 *
 *  - `cannot_link_more_of_type` / `linked_to_another_user` — the browser still holds
 *    another account's session, so the code was never checked at all.
 *  - `invalid_credentials` — the code is spent or expired, and the retry that works is
 *    a NEW code.
 *  - 429 / "too many" — a throttle, not a bad digit.
 *
 * Anything else at the code step still gets `CODE_REFUSED`, which is now the fallback
 * rather than the rule.
 */
export function describePrivySignInFailure(
  error: unknown,
  step: PrivyFailureStep = 'session'
): string {
  const { code, status, message } = readVendorRefusal(error);

  if (/invalid_origin|origin/i.test(message)) {
    return (
      'Sign-in failed: this site’s origin is not on the app id’s allowed origins. ' +
      'Add it in the Privy dashboard (Settings → Domains), then try again.'
    );
  }

  // A stale session on this browser, and NOT a code problem: Privy refused to link a
  // second email onto the account the browser is already signed in as (#515). True on
  // either step — this is what a correct code was being blamed for.
  if (
    code === 'cannot_link_more_of_type' ||
    code === 'linked_to_another_user' ||
    /already has one email account linked/i.test(message)
  ) {
    return OTHER_ACCOUNT_SIGNED_IN;
  }

  // Matched on the STATUS as well as the text, because the text branch alone can
  // never fire for OUR backend's 503: the API client replaces the server's
  // sentence with its own (`ApiError.message`, see `lib/api/client.ts`), so
  // "not configured" never reaches `error.message`. Only the status survives.
  if ((error instanceof ApiError && error.status === 503) || /503|not configured/i.test(message)) {
    return (
      'Sign-in failed: the backend cannot verify Privy tokens. Set PRIVY_APP_ID and ' +
      'PRIVY_APP_SECRET in backend/.env, using the same app as ' +
      'NEXT_PUBLIC_PRIVY_APP_ID, then restart it and try again.'
    );
  }

  // A request that never left the device says nothing about this customer's
  // connection when WE are the ones deploying, and "Check your connection" is the
  // one line that makes someone toggle wifi over our rollout (#284). It gets the
  // same sentence the session restore gives for the same event, so one outage does
  // not read two different ways a minute apart.
  if (error instanceof ApiError && error.status === REFUSAL_NETWORK_STATUS) {
    return SESSION_UNREACHABLE.message;
  }

  if (error instanceof ApiError) return refusalMessage(error, 'account');

  if (step === 'code') {
    // Spent, not mistyped: the retry that works is a NEW code.
    if (code === 'invalid_credentials' || /invalid email and code/i.test(message)) {
      return CODE_SPENT;
    }

    // `429` arrives as a status on the API error and as text on the SDK's own throttle
    // guard, so both shapes are read.
    if (status === 429 || code === 'too_many_requests' || /too many/i.test(message)) {
      return TOO_MANY_ATTEMPTS;
    }
  }

  return step === 'code' ? CODE_REFUSED : refusalMessage(error, 'account');
}
