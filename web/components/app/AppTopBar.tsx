'use client';

import { BrandMark } from '@/components/ui';
import { TopBarState } from './TopBarState';

/**
 * The app's header: the FRAME across the top of the canvas (#559).
 *
 * ## Why it is not a slab any more
 *
 * The first cut drew it as the dock's twin — a panel of `canvas-dark` with its own corners, capped
 * at `26rem` on a phone and the content column's width above it, floating off the top edge with the
 * page's own heading 24px below. Three things were wrong with that, and only one of them was taste:
 *
 *  1. **It was an object over an object.** A panel floating above the content says "this is a
 *     control". The header is not a control, it is the window. The dock floats because it IS a
 *     control over the page; the header floating too leaves a page with two floating things and no
 *     frame.
 *  2. **Three widths, no shared edge.** The panel capped at 416px, the swap card at 464px, the rate
 *     line on the card's width: nothing on the screen agreed with anything. That is the defect the
 *     swap column was fixed for (#545), one object up.
 *  3. **Content was CUT, not scrolled.** `sticky` plus an opaque fill plus a hard bottom edge means
 *     the page's own title and the pair's rate line vanish under a black edge with nothing to say
 *     they went anywhere. On `/app/swap` that is the screen's heading disappearing behind its own
 *     chrome.
 *
 * The header cannot be fixed page by page: `AppShell` mounts it once on every `/app` surface, so
 * the fault was its FORM and the fix is here.
 *
 * ## What it is now
 *
 * Edge to edge, one bottom hairline, no corners: the shape the design doc already gives `nav-bar`
 * (`canvas-dark`, `on-dark`) and the same height as the dock's slab, because both ends of the
 * chrome sharing one number is what makes them one system. The ROW inside it is the page column —
 * `max-w-3xl` and `px-5`, the same numbers `AppShell` puts on `main` — so the brand and the account
 * control sit on the card's own left and right edges instead of 176px in from them.
 *
 * It stays `sticky`, and that is not cosmetic: the practice chip is the only standing signal that
 * the money is not real, and #542 moved it here from a full-width strip precisely so it could stay
 * visible. A header that scrolled away would quietly weaken a money fact.
 *
 * Its fill is the dock's fill — solid `canvas-dark` — and the content fades out under it through a
 * 12px gradient below the hairline. A translucent bar was the first attempt and it measured wrong:
 * `/85` over a white canvas composites to `rgb(47,47,47)` while the dock stays `rgb(13,11,13)`, so
 * one screen carried two different blacks and the header read as a grey wash rather than as the
 * same material. The gradient does the job the alpha was there for — content leaves through a fade
 * instead of being cut at a hard line — without moving the colour.
 *
 * The brand stays here rather than in the dock: the dock holds PLACES, the header holds what the
 * ACCOUNT is (#542), and the five-in-one slab that made the dock crammed at 390px is why that split
 * exists at all.
 *
 * The reference set does this and does not float a pill above a card: Uniswap and OKX web carry a
 * full-bleed brand-left / account-right bar with a hairline, and the transaction screens that drop
 * the brand (Fuse, Orb) put the title alone at the top rather than a second floating object.
 */
export function AppTopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline-dark bg-canvas-dark text-on-dark">
      <div className="mx-auto flex h-[var(--app-nav-bar)] w-full max-w-3xl items-center justify-between gap-3 px-5">
        <BrandMark expression="friendly" canvas="dark" className="h-7" />

        <TopBarState />
      </div>

      {/* The chrome's grain, across the whole band: the same inert, static layer the dock draws.
          A sibling of the row rather than a child, so it textures the full-width frame and not only
          the column inside it; `pointer-events: none` keeps the brand and the state control
          working through it. */}
      <div aria-hidden className="chrome-grain" />

      {/* The fade under the frame: content leaves the viewport through 12px of the frame's own
          colour rather than being cut at a hard line, which is what an opaque sticky bar does on
          its own. Decoration, so it takes no clicks and names nothing to a screen reader. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-full h-3 bg-gradient-to-b from-canvas-dark/40 to-transparent"
      />
    </header>
  );
}
