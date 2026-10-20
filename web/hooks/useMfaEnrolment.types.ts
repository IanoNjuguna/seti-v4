/**
 * The enrolment screen's state, and the two ways to satisfy it.
 *
 * `step` is what the panel renders: the choice, the passkey attempt, or the
 * authenticator instructions. `busy` is the promise, never inferred from `step` —
 * the passkey step is on screen for the duration of a device dialog, and the
 * authenticator step is on screen while nothing is pending at all.
 */
export type MfaEnrolStep = 'choose' | 'passkey' | 'totp';

export interface MfaTotpMaterial {
  /** The base32 secret the authenticator app needs, shown as text under the intro. */
  secret: string;
  /** The `otpauth://` URL, used as a one-tap "open in my app" link on a phone. */
  authUrl: string;
}

export interface MfaEnrolmentValue {
  step: MfaEnrolStep;
  busy: boolean;
  /** A sentence for the customer, never a vendor message. `mfa.constants.ts` holds them. */
  error: string | null;
  /** Present once the authenticator path has started and Privy has issued the secret. */
  totp: MfaTotpMaterial | null;
  code: string;
  setCode: (value: string) => void;
  /** Link a passkey to this device if needed, then enrol it as the second factor. */
  choosePasskey: () => void;
  /** Start the authenticator path: fetch the secret and show the instructions. */
  chooseTotp: () => void;
  /** Submit the six digits the authenticator app is showing. */
  submitTotp: () => void;
  /** Back to the choice, clearing whatever the last attempt left behind. */
  back: () => void;
}
