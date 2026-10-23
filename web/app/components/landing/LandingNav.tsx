'use client';

import Link from 'next/link';
import { SearchModal } from '@/app/components/SearchModal';
import { BrandMark } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { AudienceSelector } from './AudienceSelector';
import { NavLinks } from './NavLinks';
import { NavMenuButton } from './NavMenuButton';
import { NavMenuPanel } from './NavMenuPanel';
import { NavSearchButton } from './NavSearchButton';
import { MENU_PANEL_ID } from './LandingNav.constants';
import { useNavMenu } from './useNavMenu';
import { useNavSearch } from './useNavSearch';
import { useScrollNav } from './useScrollNav';
import type { AudienceProps } from './Audience.types';

/**
 * The landing nav: `nav-bar` from `design/revolut.md` — black, 64px, full bleed,
 * opaque — with the page's two readers' choice in it, and a state that arrives
 * when the reader leaves the top of the page.
 *
 * THE SCROLLED STATE IS CSS, AND THE HOOK ONLY SAYS WHICH ONE. `useScrollNav`
 * writes `data-scrolled` on this `<header>`; `.landing-nav` and `.landing-nav-bar`
 * in `globals.css` carry the transition and the two states, and the comment there
 * records every property and why it moved or did not. Two consequences that
 * matter: nothing on this component re-renders while the page is scrolled, and the
 * SERVER-RENDERED HTML is the rest state, so a browser that never hydrates keeps
 * the bar it would have had before this change.
 *
 * IT STAYS SOLID BLACK IN BOTH STATES. The reference fades to a translucent black
 * behind a blur; over a white band that reads as grey plastic, which is the fault
 * a previous version of this bar was corrected for. Solid black is the one surface
 * that holds on both canvases, so a white band scrolling under it can never change
 * what the labels sit on.
 *
 * `pointer-events` IS SPLIT ON PURPOSE. The header is `fixed` and, once scrolled,
 * carries 8px of its own inset above the bar; without `pointer-events-none` on the
 * shell and `auto` on the bar, that strip would eat clicks on whatever is under it.
 *
 * THE SELECTOR SITS BETWEEN THE BRAND AND THE LINKS (the reference puts its own
 * two-segment control in exactly that place), and it is where it is because it is
 * the one control on this bar that changes the page rather than leaving it. Below
 * `md` it moves into the menu panel: at 360px the row is brand, Sign in and the
 * menu control, and two more segments would take the width the brand needs. That
 * is also why THE CENTRE LINKS NOW START AT `lg`, not `md`: brand + selector +
 * search + menu + Sign in is 500px of a 720px row at 768, and the links need 300
 * more, so they cannot share it. The menu carries the links below `lg` (it always
 * carried them below `md`), so nothing is unreachable.
 *
 * TWO CONTROLS ON THE RIGHT, AND WHICH ONE IS THERE DEPENDS ON THE WIDTH, exactly
 * as before: the ⌘K palette at `lg` and up, and below `lg` a menu control in its
 * place, because a keyboard shortcut cannot be pressed on a phone. Both share one
 * height (`h-11`), one radius (`rounded-md`) and one edge.
 *
 * The menu is a disclosure, not a drawer: `useNavMenu` owns its state and its two
 * dismissals, the panel is a sibling of its own control, and nothing is trapped.
 * `Sign in` stays the right edge — the doc's own mobile rule.
 */
export function LandingNav({ audience }: AudienceProps) {
  const scrollRef = useScrollNav();
  const { open, openSearch, closeSearch } = useNavSearch();
  const {
    open: menuOpen,
    toggle: toggleMenu,
    close: closeMenu,
    containerRef: menuContainerRef,
    buttonRef: menuButtonRef,
  } = useNavMenu();

  return (
    <>
      <header
        ref={scrollRef}
        className="landing-nav pointer-events-none fixed inset-x-0 top-0 z-50"
      >
        <nav aria-label="Main" className="landing-nav-bar pointer-events-auto relative">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
            <div className="flex items-center gap-4">
              <Link
                href="#hero"
                className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
              >
                {/* Decorative: the wordmark beside it names the product. */}
                <BrandMark expression="neutral" canvas="dark" className="h-7" />
                <span className="font-brand text-heading-sm font-medium text-on-dark">seti</span>
              </Link>

              <div className="hidden md:block">
                <AudienceSelector audience={audience} />
              </div>
            </div>

            <NavLinks />

            <div className="flex items-center gap-3">
              <NavSearchButton onOpen={openSearch} />

              {/* The container `useNavMenu` tests for an outside tap: the control
                  and the panel it opens are one region, so a tap on either is not
                  a dismissal. `lg:hidden` takes the whole region (panel included,
                  since `display: none` hides a subtree) off at `lg` and up, where
                  the centre links are back and the menu has nothing to open. */}
              <div ref={menuContainerRef} className="lg:hidden">
                <NavMenuButton
                  open={menuOpen}
                  onToggle={toggleMenu}
                  panelId={MENU_PANEL_ID}
                  buttonRef={menuButtonRef}
                />
                <NavMenuPanel
                  open={menuOpen}
                  onNavigate={closeMenu}
                  audience={audience}
                />
              </div>

              <Link
                href={SIGN_IN_PATH}
                className="inline-flex h-12 items-center rounded-md bg-canvas-light px-6 text-body-sm font-semibold text-canvas-dark transition-colors duration-(--duration-quick) ease-out hover:bg-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
              >
                Sign in
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <SearchModal open={open} onClose={closeSearch} />
    </>
  );
}
