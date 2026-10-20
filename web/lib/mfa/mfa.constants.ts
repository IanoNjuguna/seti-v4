/**
 * Whether the enrolment gate is armed, and every word it says.
 *
 * ## Why this ships OFF
 *
 * The gate sits in front of money. With it armed, an account with no second factor
 * cannot sign a transfer until it enrols one, which is the whole point — and also
 * means a defect here blocks real payments instead of being noticed in a review. The
 * ceremony it depends on (a platform passkey dialog, an authenticator app's six
 * digits) cannot be exercised by CI, and an agent cannot complete one at all. So the
 * code lands proven by typecheck and lint only, and arming it is one deliberate line
 * changed after a device test on the deployed origin.
 *
 * Flipping it is the whole migration: no data changes, no dashboard change, no
 * backfill. Set it back to false to disarm.
 *
 * ## Why the words live here
 *
 * The customer never reads a vendor's phrasing (`services/auth.ts` makes the same
 * call about the SDK's own errors). Privy's failures name a mechanism; these name
 * what the person does next, and they are in one file so the screen cannot drift
 * from the sentences beside it.
 */

export const MFA_ENROLLMENT_ENFORCED = true;

export const MFA_ENROL_COPY = {
  /** The panel's one heading: the action, in the customer's own words. */
  title: 'Add a way to confirm it is you',
  /** Why, in one line, and about the thing they care about rather than the mechanism. */
  body: 'This is what stops someone who has your email from moving your money.',
  passkey: {
    label: 'Use this device',
    detail: 'Your fingerprint, face or screen lock. Nothing to remember.',
  },
  totp: {
    label: 'Use an authenticator app',
    detail: 'A six-digit code from an app on your phone.',
  },
  totpIntro: 'Add this to your authenticator app, then enter the six digits it shows.',
  totpSecretLabel: 'Or type this key into the app',
  totpOpen: 'Open in my authenticator app',
  codeLabel: 'Six-digit code',
  codeHint: 'The app refreshes it every 30 seconds.',
  submit: 'Turn on',
  back: 'Use a different way',
  done: 'Turned on. You can carry on.',
  /** Shown while the device's own passkey dialog is up, so the screen is not two dead buttons. */
  passkeyWaiting: 'Waiting for your device…',
  /** Disarmable in one line: see the note above. */
  errors: {
    /**
     * The passkey dialog was dismissed, or the device has no platform
     * authenticator. Both are the same event to the person and both are fixed by
     * trying again on the device, so they share one sentence that says so.
     */
    passkey:
      'That did not finish. If your device asked you to cancel, try again and let it use your fingerprint or screen lock.',
    /** A code that arrived already used, expired, or mistyped. All three are "try again". */
    totp: 'That code was not right. Check the six digits and try again.',
    /** Nothing recognised: name the step rather than the SDK. */
    generic: 'That did not finish. Try again.',
  },
} as const;
