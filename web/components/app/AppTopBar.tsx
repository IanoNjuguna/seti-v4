'use client';

import { BrandMark } from '@/components/ui';
import { TopBarState } from './TopBarState';

/**
 * The app's header: a floating slab that carries the brand and whatever the ACCOUNT's state is
 * (#542, revised).
 *
 * ## Why the mark and the sign-in live here and not in the dock
 *
 * The first cut put everything in the bottom dock: the mark, a hairline, three destinations, a
 * second hairline and `Sign in`. At 390px that is five things in one 324px slab, and the owner's
 * read was that it was cramped by its own density. Splitting it is the fix: the dock is for PLACES
 * you go, this is for what the account IS — the brand, whether you are signed in, whether the money
 * is real. Two objects, each with one job, and the dock keeps three items and the air to spread
 * them.
 *
 * ## Its shape is the dock's shape
 *
 * Same material, same radius, same width, same axis: a rounded rectangle of `canvas-dark` with the
 * chrome grain and one hairline, capped at the same `max-w` as the dock and centred on the content
 * column. Fey draws its chrome as floating pills and Luma and Fabric as floating toolbars; the rule
 * this app keeps is that chrome is a slab with rounded corners, never a full-bleed band.
 *
 * ## It is in the flow, not fixed
 *
 * Deliberately. The dock is the fixed control; a second fixed slab would sit under the practice
 * strip (`PracticeFrame` is sticky at the top) and give every screen two things to clear. This one
 * scrolls away with the page, which is also the honest hierarchy: you can always reach a place from
 * the dock, and the header is the page's own first row.
 */
export function AppTopBar() {
  return (
    <header className="relative mb-6 flex h-14 w-full max-w-[26rem] items-center justify-between gap-3 overflow-hidden rounded-[14px] border border-hairline-dark bg-canvas-dark px-4 text-on-dark">
      <BrandMark expression="friendly" canvas="dark" className="h-7" />

      <TopBarState />

      {/* The chrome's grain, clipped to the slab's own corners. */}
      <div aria-hidden className="chrome-grain" />
    </header>
  );
}
