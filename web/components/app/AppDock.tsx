'use client';

import { BrandMark } from '@/components/ui';
import { AppNavLink } from './AppNavLink';
import { DockSignIn } from './DockSignIn';
import { useAppNav } from './useAppNav';

/**
 * The app's one navigation, at every width: a floating dock (#542).
 *
 * ## Why a dock and not a rail
 *
 * The rail was 224px of black pinned to the viewport's left edge, and the app's content is a
 * centred 768px column. They drift: 16px of white between them at 1024, 224px at 1440 — exactly
 * the rail's own width — and 784px at 2560. Past ~1100px the navigation is further from what it
 * navigates than the rail is wide, which is what a sidebar is for when it frames dense
 * full-window content and not what it is for when it frames three destinations.
 *
 * So there is one chrome, and it floats: a rounded rectangle off the bottom edge, centred on the
 * content column (it shares the column's axis because both are centred), present below `md` and
 * above it. Modelled on Fey's dock, with the owner's own correction applied — Fey's is a pill of
 * circular glyph buttons; this is a rounded rectangle of squared wells ("square with round
 * edges, not round with square edges").
 *
 * ## The head is the mark, wearing the friendly face
 *
 * Chrome identifies the product, so the head is the mark and not the lockup. It wears the
 * `friendly` expression deliberately: the role rule used to put `neutral` on all chrome, and the
 * owner moved that line so the product has one face on every chrome surface — see the rule in
 * `BrandMark.tsx`.
 *
 * The head is NOT a link. `Home` is already a destination, and a mark that also goes to `/app`
 * would be a second way into the same place, which reads as a question about which one is real.
 * It is decoration with an empty label, so a screen reader is told nothing it cannot already act
 * on, and a hairline after it keeps it from being counted as a fourth destination.
 *
 * ## Geometry, and the two numbers that keep it honest
 *
 * The slab is one `--app-nav-bar` tall (64px) so the row's height never gets re-argued, holds
 * three 44x48 wells at an 8px radius, and floats `--app-nav-inset` above the bottom edge with the
 * device's safe-area inset added below it. `--app-nav-reserved` adds those same pieces for the
 * shell, so the space kept clear for the dock and the dock's own geometry are one number rather
 * than two that can disagree — the failure mode is a fixed control resting on content.
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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[calc(var(--app-nav-inset)_+_env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto relative flex h-[var(--app-nav-bar)] items-center gap-1 overflow-hidden rounded-[14px] border border-hairline-dark bg-canvas-dark px-2 text-on-dark shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
        <BrandMark expression="friendly" canvas="dark" className="h-6" />

        <span aria-hidden className="mx-1.5 h-6 w-px shrink-0 bg-hairline-dark" />

        {items.map((item) => (
          <AppNavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <DockSignIn />

        {/* The chrome's grain, clipped to the slab's own corners. */}
        <div aria-hidden className="chrome-grain" />
      </div>
    </nav>
  );
}
