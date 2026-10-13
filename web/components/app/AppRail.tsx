'use client';

import Link from 'next/link';
import { Text } from '@/components/ui';
import { AppNavLink } from './AppNavLink';
import { useAppNav } from './useAppNav';

/**
 * Desktop side rail. Black canvas with a `hairline-dark` edge, per the doc's
 * `nav-bar` (background `canvas-dark`, text `on-dark`, 64px) — the rail is that
 * bar rotated vertical, and its brand block is exactly one `nav-bar` tall, on its
 * own hairline.
 *
 * The brand is the phoenix mark the landing nav uses plus the wordmark at
 * `heading-md`: a 20px wordmark over 48px rows read as a label on the list rather
 * than as the product's name. `pb-[safe-area-inset-bottom]` mirrors the bottom
 * bar, so the last row is never under a home indicator on a tablet.
 *
 * Known and deliberate: three destinations end about a quarter of the way down a
 * 900px column and the rest is canvas. Filling it means putting new information
 * in the chrome — an account block, or moving Sign out off Profile onto the rail
 * — which is a product decision rather than a styling one, so it is left as the
 * owner's call rather than invented here.
 */
export function AppRail() {
  const { items, isActive } = useAppNav();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 hidden w-56 flex-col overflow-y-auto border-r border-hairline-dark bg-canvas-dark px-3 pb-[env(safe-area-inset-bottom)] text-on-dark md:flex"
    >
      <Link
        href="/app"
        className="mb-2 flex h-16 shrink-0 items-center gap-3 border-b border-hairline-dark px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <img src="/red-phoenix-mark.png" alt="" className="h-8 w-auto" />
        <Text variant="section" as="span" color="inverse" className="text-heading-md">
          Seti
        </Text>
      </Link>

      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <AppNavLink key={item.href} item={item} active={isActive(item.href)} layout="rail" />
        ))}
      </div>
    </nav>
  );
}
