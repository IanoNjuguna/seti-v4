'use client';

import { AppNavLink } from './AppNavLink';
import { useAppNav } from './useAppNav';

/**
 * The app's places, at every width: a floating dock of three (#542).
 *
 * ## What changed from the first cut
 *
 * It used to hold the mark, a hairline, three destinations, a second hairline and `Sign in` — five
 * things in one 324px slab at 390px, which read as crammed. The mark and the account's state moved
 * to the header (`AppTopBar`), so this slab has one job and three items, and they spread: each item
 * is `flex-1` of the same `max-w` the header uses, so the three destinations sit at even thirds of
 * the slab instead of being packed against a divider.
 *
 * ## Why a dock and not a rail
 *
 * The rail was 224px of black pinned to the viewport's left edge, and the app's content is a
 * centred 768px column. They drift: 16px of white between them at 1024, 224px at 1440 — exactly
 * the rail's own width — and 784px at 2560. Past ~1100px the navigation is further from what it
 * navigates than the rail is wide, which is what a sidebar is for when it frames dense full-window
 * content and not what it is for when it frames three destinations.
 *
 * So there is one nav and it floats: a rounded rectangle off the bottom edge, centred on the
 * content column, present below `md` and above it. Modelled on Fey's dock with the owner's own
 * correction applied — Fey's is a pill of circular glyph buttons; this is a rounded rectangle of
 * squared wells ("square with round edges, not round with square edges").
 *
 * ## Two numbers keep it honest
 *
 * The slab is one `--app-nav-bar` tall (64px) so the row's height never gets re-argued, and it
 * floats `--app-nav-inset` above the bottom edge with the device's safe-area inset added below it.
 * `--app-nav-reserved` adds those same pieces for the shell, so the space kept clear for the dock
 * and the dock's own geometry are one number rather than two that can disagree — the failure mode
 * is a fixed control resting on content.
 *
 * The slab is `overflow-hidden` so the chrome's grain is clipped to its rounded corners, and
 * `pointer-events-none` on the wrapper keeps the strip either side of it — the page underneath —
 * scrollable and tappable.
 */
export function AppDock() {
  const { items, isActive } = useAppNav();

  return (
    <nav
      aria-label="Primary"
      data-scrollbar="dark"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-5 pb-[calc(var(--app-nav-inset)_+_env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto relative flex h-[var(--app-nav-bar)] w-full max-w-[26rem] items-center gap-1 overflow-hidden rounded-[14px] border border-hairline-dark bg-canvas-dark px-1.5 text-on-dark shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
        {items.map((item) => (
          <AppNavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        {/* The chrome's grain, clipped to the slab's own corners. */}
        <div aria-hidden className="chrome-grain" />
      </div>
    </nav>
  );
}
