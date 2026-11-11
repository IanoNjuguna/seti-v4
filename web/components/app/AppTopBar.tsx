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
 * ## It is sticky, and it carries the practice state
 *
 * The practice strip that used to sit above the content — a full-width sticky band reading
 * `PRACTICE · <note>` — is gone (#542): the state now lives in this slab's right-hand slot, which is
 * the same fact in the same place, and a strip plus a header would be two statements of it on every
 * screen. That move is why this is `sticky`: the strip was always visible, so the signal it carried
 * must stay always visible, and a header that scrolled away would have quietly weakened a money
 * fact. The sentence the strip printed stays where the money is signed (`PracticeNote`), which is
 * where the frame's own comment always said the loud moment belonged.
 *
 * The dock is the fixed control; this sticks, which keeps one object at each end of the column and
 * nothing else floating over the page.
 */
export function AppTopBar() {
  return (
    <header className="sticky top-2 z-20 mx-auto mb-6 flex h-14 w-full max-w-[26rem] items-center justify-between gap-3 overflow-hidden rounded-[14px] border border-hairline-dark bg-canvas-dark px-4 text-on-dark">
      <BrandMark expression="friendly" canvas="dark" className="h-7" />

      <TopBarState />

      {/* The chrome's grain, clipped to the slab's own corners. */}
      <div aria-hidden className="chrome-grain" />
    </header>
  );
}
