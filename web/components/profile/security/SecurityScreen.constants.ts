/**
 * What the security screen says, in one place.
 *
 * The customer never reads a vendor's phrasing — `lib/mfa/mfa.constants.ts` makes the
 * same call — so nothing here names Privy, passkeys-in-JSON or a protocol. Each
 * sentence states what is true of this account, or says that we do not know yet.
 */
export const SECURITY_COPY = {
  title: 'Security',
  intro: 'How you sign in, and what stops someone else doing it.',

  signIn: {
    title: 'How you sign in',
    body: 'You sign in with',
    unknown: 'We could not tell which method this session used. Signing out and back in will show it here.',
  },

  secondFactor: {
    title: 'A second way to confirm it is you',
    enrolledOne: 'On. Your email is not enough on its own.',
    enrolledMany: 'On, with more than one method.',
    none: 'Off. Anyone with your email can move money right now.',
    /** Said only when a method exists, because it explains the missing button. */
    cannotRemove: 'Turning a method off is not in the app yet.',
  },

  keys: {
    title: 'Your keys',
    body: 'Your wallet signs every payment on your device. Seti never holds your key and cannot spend for you.',
  },

  /**
   * The honest half. There is no session or device record in the backend, so a list of
   * devices would be invented; the screen says so and waits for the table to exist.
   */
  devices: {
    title: 'Devices',
    body: 'We do not keep a device list yet, so we cannot show you where you are signed in. A second method is what protects the account today.',
  },
} as const;

export const SIGN_IN_METHOD_COPY = {
  email: 'an emailed code',
  google_oauth: 'Google',
  wallet: 'a wallet',
  passkey: 'a passkey',
  sms: 'a text message',
  unknown: 'a method we could not name',
} as const;
