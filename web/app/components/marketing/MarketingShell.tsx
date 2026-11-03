import { LandingBackdrop } from '../landing/LandingBackdrop';
import { LandingFooter } from '../landing/LandingFooter';
import { MarketingHeader } from './MarketingHeader';
import type { MarketingShellProps } from './MarketingShell.types';

/**
 * The frame both marketing routes share: the brand bar, the grain, the landing's footer.
 *
 * THE HEADER IS A MINIMAL ONE, NOT `LandingNav` WITH AN ABSOLUTE BASE. `LandingNav`'s links
 * are the hash anchors in `NAV_LINKS` (`#how`, `#money`, `#fees`, plus `#partners` in the
 * menu), which resolve on `/` and on nothing else, and the bar also carries a command
 * palette whose sections are those same six ids. Rewriting them as `/#how` would put four
 * links in the bar that take a reader off the page they are reading, and the palette would
 * still be jumping to ids these routes do not render. A bar of two true destinations beats a
 * bar of five that leave. So the header is the lockup, which goes home, and `Sign in`, which
 * goes to the product — the same two edges `LandingNav` keeps — and `LandingNav` itself is
 * untouched, still the landing's own bar.
 *
 * THE FOOTER IS THE LANDING'S OWN COMPONENT, imported rather than copied. It carries the
 * mark, the copyright, "Made in Thika" and the three legal links; a second footer is how the
 * site ends up with two copyrights and one of them stale.
 *
 * THE GRAIN COMES WITH THE BLACK CANVAS. These routes open and close on `canvas-dark` as the
 * landing does, so they render the same layer for the same reason: a large flat black surface
 * under display type reads as generated without it. It is CSS only, `fixed` and never
 * animated, and borrowing the landing's one-line component keeps the two routes grained alike.
 */
export function MarketingShell({ children }: MarketingShellProps) {
  return (
    <div className="relative flex flex-1 flex-col bg-canvas-dark">
      <LandingBackdrop />
      <MarketingHeader />

      <main className="relative flex flex-1 flex-col">{children}</main>

      <LandingFooter />
    </div>
  );
}
