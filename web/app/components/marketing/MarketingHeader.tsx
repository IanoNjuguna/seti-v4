import Link from 'next/link';
import { BrandLockup } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import {
  HEADER_HOME_HREF,
  HEADER_NAV_LABEL,
  HEADER_SIGN_IN_LABEL,
} from './MarketingHeader.constants';

/**
 * `nav-bar` from `design/revolut.md`: black, 64px, the lockup left and one action right.
 *
 * IT DOES NOT FIX AND IT DOES NOT TRACK THE SCROLL. `LandingNav` is `fixed` and flips a
 * scrolled state at 80px because its links jump to bands further down the page. Nothing on
 * these routes is an anchor, so there is nothing a floating bar keeps in reach, and a bar
 * that moves while a reader is reading a price is motion without a job. It scrolls away.
 *
 * THE LOCKUP CARRIES ITS OWN NAME. `BrandLockup` sets the alt text from the artwork, so the
 * link to `/` has an accessible name without a wordmark set beside it — the same asset and
 * the same call the landing's bar makes.
 *
 * THE SIGN-IN CONTROL IS `h-12` AND WHITE ON BLACK, the design system's `button-primary`:
 * it is the one action in the bar, so it is the brightest pixel in it, exactly as it is in
 * `LandingNav`.
 */
export function MarketingHeader() {
  return (
    <header className="relative z-10 bg-canvas-dark">
      <nav
        aria-label={HEADER_NAV_LABEL}
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6"
      >
        <Link
          href={HEADER_HOME_HREF}
          className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
        >
          <BrandLockup className="h-7" preload />
        </Link>

        <Link
          href={SIGN_IN_PATH}
          className="inline-flex h-12 items-center rounded-md bg-canvas-light px-6 text-body-sm font-semibold text-canvas-dark transition-colors duration-(--duration-quick) ease-out hover:bg-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
        >
          {HEADER_SIGN_IN_LABEL}
        </Link>
      </nav>
    </header>
  );
}
