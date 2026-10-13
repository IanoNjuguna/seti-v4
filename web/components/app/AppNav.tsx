'use client';

import { AppNavLink } from './AppNavLink';
import { useAppNav } from './useAppNav';

/**
 * Bottom bar below `md`, matching the rail's black-canvas treatment so the
 * chrome reads as one system on both layouts.
 *
 * Two boxes, deliberately. The inner row is `h-16` — the doc's `nav-bar` height,
 * which is what makes the labels sit 6px clear of the bottom edge instead of
 * flush against it — and the outer element carries the safe-area padding, so a
 * phone with a home indicator gets 64px of bar *plus* the inset rather than a
 * 64px bar with the inset eaten out of it. `px-2` keeps the first and last
 * destination off the screen edge.
 */
export function AppNav() {
  const { items, isActive } = useAppNav();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 flex flex-col border-t border-hairline-dark bg-canvas-dark pb-[env(safe-area-inset-bottom)] text-on-dark md:hidden"
    >
      <div className="flex h-16 px-2">
        {items.map((item) => (
          <AppNavLink key={item.href} item={item} active={isActive(item.href)} layout="bar" />
        ))}
      </div>
    </nav>
  );
}
