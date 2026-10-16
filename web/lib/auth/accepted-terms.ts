import { TERMS_VERSION } from '@/lib/legal/terms';

/**
 * The Terms a sign-in may be recorded against, checked at the web front door.
 *
 * ## One version, and the web app already imports it
 *
 * The version is NOT restated here. It is `@/lib/legal/terms`, the web app's one
 * import of `backend/src/legal/terms` — the same string the legal pages print
 * their effective date from and the same one `backend/src/services/consent.ts`
 * records on the account's audit row. This module compares against it and the
 * session provider then SENDS it; a literal in either place is how a recorded
 * acceptance comes to name a version nobody was shown.
 *
 * ## Why the browser refuses an ABSENT version when the backend tolerates one
 *
 * `backend/src/services/consent.ts` treats an absent `acceptedTermsVersion` as
 * "not claiming a different version" and creates the account anyway, recording
 * `acceptedVersion: null`. That tolerance is deliberate there — its deprecated
 * `/auth/register` seeding route sends nothing, and demanding the field would
 * break an older client — and it is exactly why the check has to exist IN FRONT
 * of it. On the web an account is created by `POST /auth/verify`, so a
 * first-time account made through the headless email flow with no version on the
 * request is an account with no acceptance on record, and a consumer-protection
 * record naming no version is not one. The browser therefore requires the field
 * and a missing or stale value REFUSES the flow loudly, instead of letting the
 * account be created against nothing.
 */

/**
 * Whether the version a caller says it displayed may be recorded.
 *
 * Returns the sentence to show when it may not, or `null` when it may.
 *
 * The value is VALIDATED, never trusted. The caller supplies what its own UI
 * showed; this compares that to the one version in force, and the session
 * provider sends the version from HERE — not the caller's string — to
 * `POST /auth/verify`. A caller carrying a stale literal, a cached build, or no
 * value at all cannot have it written down as accepted.
 *
 * The refusal is worded like the backend's own (`services/consent.ts`), so a
 * customer who meets one or the other reads the same instruction.
 */
export function checkAcceptedTermsVersion(accepted: string | undefined | null): string | null {
  if (!accepted) {
    return (
      'Accept the Terms of Use to continue. This build could not tell which version ' +
      'you accepted, and signing in without it would open an account with no ' +
      'acceptance on record.'
    );
  }

  if (accepted !== TERMS_VERSION) {
    return (
      `These Terms are version ${TERMS_VERSION}, but this build accepted version ` +
      `${accepted}. Reload the page so you are shown the current Terms, accept them, ` +
      'and try again.'
    );
  }

  return null;
}
