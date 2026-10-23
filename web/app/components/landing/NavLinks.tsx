import { NAV_LINKS } from './LandingNav.constants';

/**
 * The bar's centre links: the two answers the page has to give, and what it costs.
 *
 * Their own module because they are the one part of the bar that is a LIST — and
 * because the list itself is data (`NAV_LINKS`), so a label edited there reaches
 * this file, the phone menu and the ⌘K palette at once. Every link is an in-page
 * anchor, and every id it names exists in both audience variants of the page, so a
 * jump cannot scroll to nothing whichever reader is on it.
 *
 * They are plain `<a>`s and not `next/link`: these are fragment links inside one
 * prerendered document, where the router's client-side navigation would only add a
 * transition to a scroll the browser already does natively (and `scroll-behavior:
 * smooth` in `globals.css` already animates).
 *
 * The colour step on hover is the doc's own for a dark band: the muted white comes
 * up to full `on-dark` rather than taking the cobalt, which measures 4.27:1 on
 * black and would be under AA at this size.
 */
export function NavLinks() {
  return (
    <div className="hidden items-center gap-8 lg:flex">
      {NAV_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="rounded-sm text-body-sm font-semibold text-on-dark-mute transition-colors duration-(--duration-quick) ease-out hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
