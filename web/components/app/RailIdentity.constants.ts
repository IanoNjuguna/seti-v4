/**
 * Copy for the identity card at the foot of the rail.
 *
 * The empty-mode words are deliberately NOT repeated here: they are the Profile
 * panel's, for the same action on the same account, and `PROFILE_INTENT_COPY` is
 * where they live. A second spelling of "Claim a username" is how one of the two
 * starts lying about what it does.
 */
export const RAIL_IDENTITY_COPY = {
  signedInAs: 'Signed in as',
  /** The control beside the name copies what a sender types — no `@`. */
  copyHandle: 'Copy username',
  /** The control beside the link copies the absolute URL. */
  copyLink: 'Copy link',
  copied: 'Copied',
  copyFailed: 'Select the value above to copy it.',
} as const;
