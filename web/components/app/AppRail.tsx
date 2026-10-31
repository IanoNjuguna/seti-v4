'use client';

import Link from 'next/link';
import { BrandLockup } from '@/components/ui';
import { AppNavLink } from './AppNavLink';
import { RailIdentityCard } from './RailIdentityCard';
import { RailNetworkRow } from './RailNetworkRow';
import { useAppNav } from './useAppNav';

/**
 * Desktop side rail. Black canvas with a `hairline-dark` edge, per the doc's
 * `nav-bar` (background `canvas-dark`, text `on-dark`, 64px) — the rail is that
 * bar rotated vertical, and its brand block is exactly one `nav-bar` tall, on its
 * own hairline.
 *
 * The brand is the supplied lockup now (#294): the mark and the word as one drawn object,
 * `h-8` in a `nav-bar`-tall block, instead of the neutral mark with the wordmark typeset
 * beside it. The wordmark's size used to be argued over in this comment — two size classes
 * in one `cn()` join resolved by Tailwind's emission order, so it quietly rendered at 20px
 * while the code asked for 24 — and a lockup removes the argument rather than settling it:
 * there is no word to size. `pb-[safe-area-inset-bottom]` mirrors the bottom bar, so the
 * last row is never under a home indicator on a tablet.
 *
 * Three destinations end a quarter of the way down a 900px column, and the rest
 * is canvas — deliberately empty, because filling it means putting new
 * information in the chrome. The one thing the foot still carries is the app's
 * sign-in link, and only when signed OUT (`RailIdentityCard` renders
 * `RailIdentitySignedOut`, pinned by `mt-auto`). A signed-in visitor gets no
 * footer at all: the identity the rail used to state here now lives on Profile,
 * and the rail stating it a second time was chrome repeating a page. Nothing
 * else goes in this gap; it is chrome, not a place to advertise.
 */
export function AppRail() {
  const { items, isActive } = useAppNav();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 hidden w-56 flex-col overflow-y-auto border-r border-hairline-dark bg-canvas-dark px-3 pb-[env(safe-area-inset-bottom)] text-on-dark md:flex"
    >
      {/* The chrome's grain, on the rail and nowhere else. The landing's own
          texture (`.chrome-grain` and `--app-grain-*` in `app/globals.css`) at
          HALF strength, because this surface carries 13px nav labels, a network
          row and a sign-in line and had no contrast to spare. Inert and static:
          it is `aria-hidden` and `pointer-events: none`, so it never reaches the
          accessibility tree, the tab order or a tap, and it is not animated. */}
      <div aria-hidden className="chrome-grain" />

      <Link
        href="/app"
        className="mb-2 flex h-[var(--app-nav-bar)] shrink-0 items-center gap-3 border-b border-hairline-dark px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <BrandLockup className="h-8" />
      </Link>

      <RailNetworkRow />

      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <AppNavLink key={item.href} item={item} active={isActive(item.href)} layout="rail" />
        ))}
      </div>

      <RailIdentityCard />
    </nav>
  );
}
