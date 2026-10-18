'use client';

import Link from 'next/link';
import { SearchModal } from '@/app/components/SearchModal';
import { BrandMark } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { NavMenuButton } from './NavMenuButton';
import { NavMenuPanel } from './NavMenuPanel';
import { NavSearchButton } from './NavSearchButton';
import { MENU_PANEL_ID, NAV_LINKS } from './LandingNav.constants';
import { useNavMenu } from './useNavMenu';
import { useNavSearch } from './useNavSearch';

/**
 * The landing nav — `nav-bar` from `design/revolut.md`: black, 64px, full
 * bleed, opaque.
 *
 * It used to be a floating translucent pill (`bg-canvas-dark/50` plus
 * `backdrop-blur`). Over a white band that renders as a grey plastic slab that
 * reads as a rendering fault, and the doc's nav is not a floating island. Solid
 * black is the one surface that holds on both canvases, so the page never has
 * to explain itself mid-scroll.
 *
 * NO HAIRLINE UNDER IT, and that is the ruling rather than an omission. The
 * field layer is `fixed inset-0`, so it already runs the full viewport BEHIND
 * this bar; the only thing drawing a line between the two was the 1px
 * `border-b border-hairline-dark`, which measured rgb(48,48,48) against
 * rgb(21,21,21) above it and rgb(31,27,39) below — the single brightest edge on
 * the page, and a seam the hero band did not have. Removing it lets the field
 * read as continuing up behind an opaque nav instead of stopping dead at 64px.
 * The nav stays SOLID: no translucency, no blur, so it is still legible when a
 * white band scrolls under it. The mobile menu panel below obeys the same
 * ruling: it carries no top edge either, so it reads as this bar unfolding.
 *
 * TWO CONTROLS ON THE RIGHT, AND WHICH ONE IS THERE DEPENDS ON THE WIDTH. At
 * `md` and up it is the ⌘K palette trigger. Below `md` that control is
 * `max-md:hidden` and a menu control stands in its place, because a keyboard
 * shortcut cannot be pressed on a phone and the section links the bar otherwise
 * carries are `hidden md:flex` — without the swap a phone would get the brand,
 * Sign in and no route to any section at all. Hiding one control and adding the
 * other is ONE decision, and the two share one height (`h-11`), one radius
 * (`rounded-md`) and one edge, so the row is unchanged where a visitor is
 * looking.
 *
 * The menu is a disclosure, not a drawer: `useNavMenu` owns its state and its
 * two dismissals, the panel is a sibling of its own control, and nothing is
 * trapped. Both controls share the row with `Sign in`, which stays the right
 * edge — the doc's own mobile rule ("logo stays left, sign-in CTA stays right").
 */
export function LandingNav() {
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
      <header className="fixed inset-x-0 top-0 z-50 bg-canvas-dark">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="#hero"
            className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
          >
            {/* Decorative: the wordmark beside it names the product. */}
            <BrandMark expression="neutral" canvas="dark" className="h-7" />
            <span className="font-brand text-heading-sm font-medium text-on-dark">seti</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
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

          <div className="flex items-center gap-3">
            <NavSearchButton onOpen={openSearch} />

            {/* The container `useNavMenu` tests for an outside tap: the control
                and the panel it opens are one region, so a tap on either is not
                a dismissal. `md:hidden` takes the whole region (panel included,
                since `display: none` hides a subtree) off at `md` and up, where
                the centre links are back and the menu has nothing to open. */}
            <div ref={menuContainerRef} className="md:hidden">
              <NavMenuButton
                open={menuOpen}
                onToggle={toggleMenu}
                panelId={MENU_PANEL_ID}
                buttonRef={menuButtonRef}
              />
              <NavMenuPanel open={menuOpen} onNavigate={closeMenu} />
            </div>

            <Link
              href={SIGN_IN_PATH}
              className="inline-flex h-12 items-center rounded-md bg-canvas-light px-6 text-body-sm font-semibold text-canvas-dark transition-colors duration-(--duration-quick) ease-out hover:bg-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
            >
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <SearchModal open={open} onClose={closeSearch} />
    </>
  );
}
