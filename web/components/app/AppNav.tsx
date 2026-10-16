'use client';

import { AppNavLink } from './AppNavLink';
import { useAppNav } from './useAppNav';

/**
 * Bottom bar below `md`, matching the rail's black-canvas treatment so the
 * chrome reads as one system on both layouts.
 *
 * Two boxes, deliberately. The inner row is `h-[var(--app-nav-bar)]` — the doc's
 * `nav-bar` height, which is what makes the labels sit 6px clear of the bottom
 * edge instead of flush against it — and the outer element carries the safe-area
 * padding, so a phone with a home indicator gets 64px of bar *plus* the inset
 * rather than a 64px bar with the inset eaten out of it. `px-2` keeps the first
 * and last destination off the screen edge.
 *
 * The outer element's height is `--app-nav-reserved`, and it is set rather than
 * left to its content on purpose: that is the SAME value the app shell reserves
 * below the content (`AppShell`), so the bar's geometry and the space kept clear
 * for it are one number instead of two that can disagree. Both tokens live in
 * `globals.css`; neither is restated here.
 */
export function AppNav() {
  const { items, isActive } = useAppNav();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 flex h-[var(--app-nav-reserved)] flex-col border-t border-hairline-dark bg-canvas-dark pb-[env(safe-area-inset-bottom)] text-on-dark md:hidden"
    >
      <div className="flex h-[var(--app-nav-bar)] px-2">
        {items.map((item) => (
          <AppNavLink key={item.href} item={item} active={isActive(item.href)} layout="bar" />
        ))}
      </div>

      {/* The chrome's grain, the bar's half of it: the same inert, static layer
          the rail draws, at the same half strength (`.chrome-grain` and
          `--app-grain-*` in `app/globals.css`). It covers the whole reserved
          height, including the home-indicator strip, and `pointer-events: none`
          keeps all three destinations tappable through it. */}
      <div aria-hidden className="chrome-grain" />
    </nav>
  );
}
