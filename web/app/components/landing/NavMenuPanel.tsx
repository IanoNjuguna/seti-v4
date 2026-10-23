import { cn } from '@/lib/cn';
import { AudienceSelector } from './AudienceSelector';
import { MENU_LINKS, MENU_PANEL_ID } from './LandingNav.constants';
import type { NavMenuPanelProps } from './NavMenuPanel.types';

/**
 * The menu the bar opens below `lg`: the Personal | Business selector, then the
 * five section destinations, and nothing else.
 *
 * THE SELECTOR IS HERE BECAUSE THIS IS WHERE IT LIVES ON A PHONE. The bar carries
 * it from `md` up; below that the row is brand, Search, Menu and Sign in, and two
 * more segments would take the width the brand needs. A reader on a phone must
 * still be able to say which page they are on, so the control is the panel's first
 * row — `large`, because a thumb is pressing it and 44px is the target size the
 * rest of the product uses.
 *
 * IT IS FLUSH, NOT FLOATING, and that is the ruling rather than a default. The
 * panel is `absolute inset-x-0 top-full` in the (positioned) bar, so it is the
 * bar's own width, its own canvas and its own left edge (`px-6`, the padding every
 * band and the bar itself use) — it reads as the nav unfolding, not as a card
 * hovering over the page. The bar carries no hairline under it at rest (the nav's
 * own ruling, preserved), so the panel's one edge is its bottom one: the line that
 * says where the menu stops and the page resumes. When the bar is in its scrolled
 * state the panel widens and narrows with it, because it is measured against the
 * bar rather than the viewport.
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
export function NavMenuPanel({ open, onNavigate, audience }: NavMenuPanelProps) {
  return (
    <div
      id={MENU_PANEL_ID}
      className={cn(
        'absolute inset-x-0 top-full border-b border-hairline-dark bg-canvas-dark',
        'motion-safe:transition-[opacity,translate,visibility] motion-safe:duration-(--duration-quick) motion-safe:ease-out',
        open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'
      )}
    >
      <div className="mx-auto max-w-6xl px-6 pb-2 pt-3">
        <div className="border-b border-hairline-dark pb-3 md:hidden">
          <AudienceSelector audience={audience} large />
        </div>

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
