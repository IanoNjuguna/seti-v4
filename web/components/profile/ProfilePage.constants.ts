/**
 * Copy the Profile PAGE owns.
 *
 * The page carries the words and the controls stand on the canvas, so the labels
 * that belong to the surface itself — the signed-in handle's fallback, the two
 * session badges and the legal section's heading — live here rather than as
 * literals in the page's JSX. A hand-typed string in a page is how the text ends
 * up in a card again: it has nowhere else to live.
 *
 * The SECTION words are deliberately not repeated here. The network section's are
 * `PROFILE_NETWORK_COPY`, the mode section's are `PROFILE_INTENT_COPY`, and the
 * signed-in label is the rail's identity card's (`RAIL_IDENTITY_COPY.signedInAs`)
 * — one fact, one string. A second spelling of "Signed in as" is how two surfaces
 * start disagreeing about the same account.
 */
export const PROFILE_PAGE_COPY = {
  /** Shown when the account's active mode holds no handle yet. */
  unknownAccount: 'Unknown account',
  /** Which auth source this build was signed in with. */
  privyBadge: 'Privy session',
  devBadge: 'Dev session (local only)',
  /** The legal section's heading. */
  legalTitle: 'Legal',
} as const;
