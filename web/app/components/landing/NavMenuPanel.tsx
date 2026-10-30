import { cn } from '@/lib/cn';
import { MENU_LINKS, MENU_PANEL_ID } from './LandingNav.constants';
import type { NavMenuPanelProps } from './NavMenuPanel.types';

/**
 * The menu the bar opens below `lg`: the five section destinations, and nothing else.
 *
 * IT USED TO OPEN ON A CONTROL. The Personal | Business selector was the panel's first
 * row — it lived here below `md`, where the bar had no width for it — and the five
 * links came after. The selector is gone (the page has one reading now), so the panel
 * is the links and only the links, and its first row is `How it works` at the same 48px
 * height the segments used to be.
 *
 * IT IS FLUSH, NOT FLOATING, and that is the ruling rather than a default. The
 * panel is `absolute inset-x-0 top-full` in the (positioned) bar, so it is the
 * bar's own width, its own left edge (`px-6`, the padding every band and the bar
 * itself use) — it reads as the nav unfolding, not as a card hovering over the
 * page. The bar carries no hairline under it at rest (the nav's own ruling,
 * preserved), so the panel's one edge is its bottom one: the line that says where
 * the menu stops and the page resumes. When the bar is in its scrolled state the
 * panel widens and narrows with it, because it is measured against the bar rather
 * than the viewport.
 *
 * IT SITS ON `surface-elevated`, NOT ON THE PAGE'S BLACK (#274). Flush is still
 * right, but the canvas it is flushed to cannot be the same #000 as the hero
 * underneath: on a phone the panel ends four lines down and the hero's own CTA
 * starts immediately below it, so at `canvas-dark` the last menu row and the
 * button read as one list. One step up the black ladder separates the layer while
 * keeping it a plane rather than a card, and it is the token the bar's other
 * raised detail already uses (the ⌘K chip).
 *
 * IT STAYS MOUNTED AND FADES, rather than mounting on open. A CSS transition cannot
 * run on a node that did not exist last frame, and `invisible` is what makes the
 * closed panel unreachable — `visibility: hidden` takes the links out of the tab
 * order, so a closed menu cannot be tabbed into, and the pointer events go with it.
 *
 * THE TRANSITION IS GATED ON `prefers-reduced-motion` through the repo's own
 * `motion-safe:` variant: under reduced motion the panel is simply present or
 * absent. It animates `opacity`, `translate` and `visibility` — `translate`, not
 * `transform`, because the Tailwind v4 `-translate-y-1` utility writes the
 * standalone `translate` property and a transition on `transform` would animate
 * nothing.
 */
export function NavMenuPanel({ open, onNavigate }: NavMenuPanelProps) {
  return (
    <div
      id={MENU_PANEL_ID}
      className={cn(
        'absolute inset-x-0 top-full border-b border-hairline-dark bg-surface-elevated',
        'motion-safe:transition-[opacity,translate,visibility] motion-safe:duration-(--duration-quick) motion-safe:ease-out',
        open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'
      )}
    >
      <div className="mx-auto max-w-6xl px-6 pb-2 pt-3">
        <ul>
          {MENU_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={onNavigate}
                className="flex h-12 items-center rounded-sm text-body-md font-semibold text-on-dark-mute transition-colors duration-(--duration-quick) ease-out hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
