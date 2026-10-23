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
