/**
 * Copy for the foot of the rail, plus the copy-control words shared with Profile.
 *
 * The signed-in strings are gone with the block that used them: `signedInAs`
 * ("Signed in as") and `copyLink` ("Copy link") were read only by the rail's
 * identity card, which no longer exists — the rail states nothing signed in. A
 * string kept for a surface that is gone is how a deleted sentence comes back.
 * `signedOutBody` was removed for the same reason: nothing rendered it, and an
 * exported string nothing reads is the same hazard.
 *
 * The empty-mode words are deliberately NOT repeated here: they are the Profile
 * panel's, for the same action on the same account, and `PROFILE_INTENT_COPY` is
 * where they live. A second spelling of "Claim a username" is how one of the two
 * starts lying about what it does.
 */
export const RAIL_IDENTITY_COPY = {
  /**
   * The signed-out card — the app's ONE sign-in affordance, so it says what
   * signing in is FOR rather than offering a bare button. No crypto vocabulary:
   * a balance and the name people pay you at are the two things a visitor cannot
   * see, and "sign in" is the only word used for asking.
   */
  signedOutTitle: 'Not signed in',
  /**
   * The control beside the name copies what a sender types — no `@`.
   * Still read by Profile's handle panel (`ProfileHandlePanel`), so it stays.
   */
  copyHandle: 'Copy username',
  /** Shared with Profile's handle panel. */
  copied: 'Copied',
  /** Shared with Profile's handle panel. */
  copyFailed: 'Select the value above to copy it.',
} as const;
