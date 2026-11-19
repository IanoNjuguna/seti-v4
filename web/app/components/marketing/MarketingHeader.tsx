'use client';

import Link from 'next/link';
import { BrandLockup } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { MENU_PANEL_ID } from '../landing/LandingNav.constants';
import { NavMenuButton } from '../landing/NavMenuButton';
import { NavMenuPanel } from '../landing/NavMenuPanel';
import { useNavMenu } from '../landing/useNavMenu';
import {
  HEADER_HOME_HREF,
  HEADER_LINKS,
  HEADER_NAV_LABEL,
  HEADER_SIGN_IN_LABEL,
} from './MarketingHeader.constants';

/**
 * `nav-bar` from `design/revolut.md`: black, 64px, the lockup left, links centre, one action
 * right — the landing bar's arrangement over this shell's own routes (#586).
 *
 * IT IS THE LANDING BAR WITH DIFFERENT DESTINATIONS, and every difference comes from being a
 * different page rather than from a different design: the centre links are `next/link`s to
 * real routes instead of `#` fragments, there is no ⌘K palette (that palette jumps between
 * bands of ONE page, and these routes have one band each), and the disclosure below `lg`
 * lists these three routes instead of the landing's sections. The control, the panel, the
 * heights and the type are the landing's own components, imported rather than copied, so a
 * change to one bar's chrome reaches both.
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
 * THE SIGN-IN CONTROL STAYS `h-12` AND WHITE ON BLACK, the design system's `button-primary`.
 * That is now the one place this bar differs from the landing's, where `Sign in` is a word:
 * there the hero's `Claim your name` is the page's action and a second filled box competed
 * with it, while these routes have no other call to action in view, so the bar's one action
 * is the one bright thing in it.
 */
export function MarketingHeader() {
  const { open, toggle, close, containerRef, buttonRef } = useNavMenu();

  return (
    <header className="relative z-10 bg-canvas-dark">
      <nav
        aria-label={HEADER_NAV_LABEL}
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6"
      >
        <div className="flex items-center gap-8">
          <Link
            href={HEADER_HOME_HREF}
            className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
          >
            <BrandLockup className="h-7" preload />
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            {HEADER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-sm text-body-sm font-semibold text-on-dark-mute transition-colors duration-(--duration-quick) ease-out hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* The container `useNavMenu` tests for an outside tap: control and panel are one
              region, so a tap on either is not a dismissal. `lg:hidden` takes the region
              off at `lg` and up, where the centre links are back. */}
          <div ref={containerRef} className="lg:hidden">
            <NavMenuButton
              open={open}
              onToggle={toggle}
              panelId={MENU_PANEL_ID}
              buttonRef={buttonRef}
            />
            <NavMenuPanel open={open} onNavigate={close} links={HEADER_LINKS} />
          </div>

          <Link
            href={SIGN_IN_PATH}
            className="inline-flex h-12 items-center rounded-md bg-canvas-light px-6 text-body-sm font-semibold text-canvas-dark transition-colors duration-(--duration-quick) ease-out hover:bg-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
          >
            {HEADER_SIGN_IN_LABEL}
          </Link>
        </div>
      </nav>
    </header>
  );
}
