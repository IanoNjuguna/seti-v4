import { logAuditEvent } from './audit.js';
import { TERMS_VERSION } from '../legal/terms.js';

/**
 * The terms a customer accepts at sign-up, and how that acceptance is recorded.
 *
 * ## One version, read from one place
 *
 * The version recorded here is IMPORTED, never restated: `legal/terms.ts` is the
 * single source, and the web app's terms copy reads the same module. A second
 * literal in this file is how a recorded consent comes to name a version nobody
 * was shown.
 *
 * ## The client's version is evidence, not the record
 *
 * The browser sends the version it displayed and had ticked
 * (`acceptedTermsVersion`). That value is never written as the record — it is the
 * client's claim about what it showed, and a client can be stale, cached, or
 * simply wrong. What is RECORDED is `termsVersion`: this server's own version, the
 * one a browser reaching this API at this moment should have been showing.
 *
 * The claim is still checked, and the check is a REFUSAL rather than a note. If
 * the client accepted a different version, the customer was shown different terms
 * (or was shown them and the terms have since been revised). Recording this
 * server's version would then assert an acceptance nobody gave, so the account is
 * not created — the same fail-closed shape as a payment whose receipt does not
 * match the claim.
 */
export { TERMS_VERSION };

/** The one way a client-supplied acceptance can be refused. */
export type ConsentRefusalCode = 'terms-version-stale';

export interface ConsentRefusal {
  code: ConsentRefusalCode;
  reason: string;
}

/**
 * Whether the version a client says it accepted is the one in force — the PURE
 * decision, so both the refusal and the acceptance are pinnable without a
 * database.
 *
 * An ABSENT version is not a refusal: a client that sends nothing is not
 * claiming to have accepted a different version, and the guard here exists to
 * catch a disagreement, not to demand a field. The sign-up screen does send one
 * (the checkbox is the acceptance), and `/auth/register` — the deprecated
 * local-seeding route — does not.
 */
export function checkAcceptedTermsVersion(accepted: string | undefined): ConsentRefusal | null {
  if (accepted === undefined) return null;
  if (accepted === TERMS_VERSION) return null;

  return {
    code: 'terms-version-stale',
    reason:
      `These Terms are version ${TERMS_VERSION}, but this app accepted version ` +
      `${accepted}. Reload it so you are shown the current Terms, accept them, and ` +
      'try again.',
  };
}

export interface SignupConsentInput {
  /** The account the acceptance belongs to. Also the audit row's `userId`. */
  userId: string;
  /** What the client claimed it accepted, if it sent anything. Evidence only. */
  acceptedVersion?: string;
  /** The address the sign-up came from, as every other audit row records it. */
  ip?: string;
}

/**
 * Write the ONE consent row for a newly created account.
 *
 * Called only from the creation path, and only when the account did not already
 * exist — see `services/signup.ts`, which is the only caller. The timestamp is
 * the row's own `createdAt`, so it is the database's clock rather than a value
 * the request could name.
 */
export async function recordSignupConsent(input: SignupConsentInput) {
  return logAuditEvent({
    userId: input.userId,
    action: 'user.consent-recorded',
    ip: input.ip,
    metadata: {
      termsVersion: TERMS_VERSION,
      acceptedVersion: input.acceptedVersion ?? null,
    },
  });
}
