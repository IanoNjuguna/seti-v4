/**
 * The route the product's front door lives at.
 *
 * ONE literal, read by every surface that sends somebody to sign in — the
 * landing page's nav, hero and closing CTAs, the app rail's identity card, and
 * the profile page's signed-out shape. A second spelling of it is how one of
 * them ends up pointing at a 404, and sign-in is the one link on the site that
 * must never 404.
 *
 * It is a top-level route on purpose. Sign-in is not a screen of the product
 * app: no rail, no bottom bar, no app chrome — the same reason a bank does not
 * put its front door inside a room.
 */
export const SIGN_IN_PATH = '/signin';

/**
 * The app's home, which is also the destination the header's brand points at.
 *
 * Two surfaces link here and they must never disagree: the dock's `Home` item and
 * the lockup. A brand that goes somewhere else than the tab called Home is a link
 * a customer has already learned to trust (#559), and the failure is invisible —
 * both render, one is just wrong.
 */
export const APP_HOME_PATH = '/app';
