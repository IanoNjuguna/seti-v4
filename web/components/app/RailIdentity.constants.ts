/**
 * Copy for the foot of the rail, signed out.
 *
 * The signed-in strings are gone with the block that used them: `signedInAs`
 * ("Signed in as") and `copyLink` ("Copy link") were read only by the rail's
 * identity card, which no longer exists: the rail states nothing signed in. A
 * string kept for a surface that is gone is how a deleted sentence comes back.
 *
 * The copy-control words (`copyHandle`, `copied`, `copyFailed`) went the same way,
 * with their last reader: the Profile handle panel. The identity block states the
 * handle without a control beside it, and the surface that hands a handle out
 * (Receive) owns the copy button for it.
 *
 * The empty-mode words are deliberately NOT repeated here: they are
 * `PROFILE_INTENT_COPY`'s, for the same action on the same account, and
 * `useRailIdentity` reads them for Receive's name half. A second spelling of
 * "Claim a username" is how one of the two starts lying about what it does.
 */
export const RAIL_IDENTITY_COPY = {
  /**
   * The signed-out card: the app's ONE sign-in affordance, so it says what
   * signing in is FOR rather than offering a bare button. No crypto vocabulary:
   * a balance and the name people pay you at are the two things a visitor cannot
   * see, and "sign in" is the only word used for asking.
   */
  signedOutTitle: 'Not signed in',
} as const;
