/**
 * Copy the Profile page itself owns.
 *
 * The page has no title of its own any more: the first thing on it is the person
 * (medallion, name, handle), so the word "Profile" no longer opens anything. What
 * is left here is the settings group's heading, the label over the legal
 * documents, the plain title of each settings row, and the one sentence a visitor
 * gets.
 *
 * Row-level words that belong to a control stay with that control:
 * `PROFILE_INTENT_COPY` for the mode row, `PROFILE_LEGAL_LINKS` for the three
 * documents, `PROFILE_SHORTCUTS` for the two rows above the list.
 */
export const PROFILE_PAGE_COPY = {
  /** The heading over the dense settings list. */
  settingsHeading: 'Settings',
  /** The label over the three documents. */
  legalLabel: 'Legal',
  personalTitle: 'Personal information',
  networkTitle: 'Network',
  /** The accessible name of the two shortcut rows, which are a nav of their own. */
  shortcutsLabel: 'Ways to use your account',
  /**
   * ONE sentence, not two.
   *
   * The signed-out page used to say "Sign in to see which network you are on" and
   * "Sign in to see your name": the same instruction twice, over a shape that had
   * nothing behind it either way. A visitor gets the sentence and the way in, in
   * the place the identity block stands.
   */
  signedOutLine: 'Sign in to see your account and settings.',
  /** The one control a signed-out visitor gets: the way to the front door. */
  signedOutAction: 'Sign in',
} as const;
