/**
 * Copy the Profile PAGE owns.
 *
 * The page carries the words and the controls stand on the canvas, so the labels
 * that belong to the surface itself — the page's title, the legal row's heading, and
 * the one control a visitor gets — live here rather than as literals in the page's
 * JSX. A hand-typed string in a page is how the text ends up in a card again: it has
 * nowhere else to live.
 *
 * The ROW words are deliberately not repeated here. The network row's are
 * `PROFILE_NETWORK_COPY` and the mode row's are `PROFILE_INTENT_COPY`.
 *
 * The signed-in IDENTITY line is not here, and no second spelling of it is either:
 * the rail's identity card owns it (`RAIL_IDENTITY_COPY.signedInAs` and the
 * `@handle`), and the page deliberately does not repeat a line the rail already
 * states.
 */
export const PROFILE_PAGE_COPY = {
  /** The page's own title, at page level — the same word the nav uses for the route. */
  title: 'Profile',
  /** The legal row's heading. */
  legalTitle: 'Legal',
  /** The one control a signed-out visitor gets: the way to the front door. */
  signedOutAction: 'Sign in',
} as const;
