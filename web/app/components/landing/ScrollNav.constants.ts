/**
 * Where the landing navbar changes state, and the attribute that says so.
 *
 * Kept next to the hook rather than inline so the CSS, the hook and this
 * comment cannot disagree about one number.
 */

/**
 * The threshold, in pixels of scroll.
 *
 * 80 is minisend.xyz's own number (`useMotionValueEvent(scrollY, 'change', v =>
 * setScrolled(v > 80))`), kept rather than tuned to this page. It is roughly
 * one nav height plus the bar's own scrolled inset, which is exactly the point
 * at which a bar still flush with the top of the document has visibly stopped
 * being the top of the document: past it, the band underneath is arriving under
 * the bar rather than starting at it.
 *
 * Deliberately not a fraction of the viewport. A percentage threshold would fire
 * at a different place on a phone than on a laptop, and the state change is
 * about the bar's own size, not the screen's.
 */
export const SCROLL_NAV_THRESHOLD_PX = 80;

/**
 * Where the state comes back, in pixels of scroll.
 *
 * THE SAME NUMBER IN BOTH DIRECTIONS IS A FLICKER (#282). With one threshold, a
 * reader parked on it with a trackpad — or on a phone with momentum scrolling —
 * crosses it in both directions several times a second, and each crossing
 * restarts the bar's transition, so the bar is seen half-way between its two
 * states rather than in either. The bar now comes in above 80 and goes back out
 * below 24, which is the bar's own height minus its logo: enough hysteresis that
 * no plausible scroll can oscillate it, and small enough that a reader scrolling
 * to the top sees the full-bleed bar before they have arrived.
 *
 * It is not a second hand-off point, so it is not in the CSS: only `80` starts
 * the motion, and the CSS still keys on one attribute.
 */
export const SCROLL_NAV_RELEASE_PX = 24;

/**
 * The attribute the hook writes on the header, and the only thing the CSS keys
 * the scrolled state on.
 *
 * A data attribute rather than a class, for the reason `useRevealOnce` arms its
 * sections with one: it is not a style, it is a state, and it is written by JS
 * alone. The server-rendered HTML therefore carries the REST state, so a browser
 * that never hydrates keeps a solid, full-bleed nav instead of a bar stuck
 * half-way between two states. The attribute is present-and-empty when scrolled
 * (`data-scrolled=""`), so the CSS selector is an attribute-existence test.
 */
export const SCROLL_NAV_ATTRIBUTE = 'data-scrolled';
