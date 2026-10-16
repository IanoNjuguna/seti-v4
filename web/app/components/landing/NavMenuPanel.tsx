import { cn } from '@/lib/cn';
import { MENU_LINKS, MENU_PANEL_ID } from './LandingNav.constants';
import type { NavMenuPanelProps } from './NavMenuPanel.types';

/**
 * The menu the bar opens on a phone: the four section destinations, and nothing
 * else.
 *
 * IT IS FLUSH, NOT FLOATING, and that is the ruling rather than a default. The
 * panel is `absolute inset-x-0 top-full` in the fixed header, so it is the bar's
 * own width, its own canvas and its own left edge (`px-6`, the padding every
 * band and the bar itself use) — it reads as the nav unfolding, not as a card
 * hovering over the page. The bar carries no hairline under it (the nav's own
 * ruling, preserved), so the panel's one edge is its bottom one: the line that
 * says where the menu stops and the page resumes.
 *
 * IT STAYS MOUNTED AND FADES, rather than mounting on open. A CSS transition
 * cannot run on a node that did not exist last frame, and `invisible` is what
 * makes the closed panel unreachable — `visibility: hidden` takes the links out
 * of the tab order, so a closed menu cannot be tabbed into, and the pointer
 * events go with it. That is the whole reason this is a class toggle and not a
 * conditional render.
 *
 * THE TRANSITION IS GATED ON `prefers-reduced-motion`, through the repo's own
 * `motion-safe:` variant: under reduced motion the panel is simply present or
 * absent, with no travel and no fade, which is the rule reduced motion asks for
 * rather than a slower version of the same motion. It animates `opacity`,
 * `translate` and `visibility` — `translate`, not `transform`, because the
 * Tailwind v4 `-translate-y-1` utility writes the standalone `translate`
 * property, and a transition on `transform` would animate nothing.
 *
 * THE LINKS ARE ROWS. Each one is a full-width 48px target on the panel's own
 * left edge, not a centred chip: a menu is a list of places, and `text-body-md`
 * at 600 is the bar's own type role (`button-md`) so the rows and the bar above
 * them are one voice.
 */
export function NavMenuPanel({ open, onNavigate }: NavMenuPanelProps) {
  return (
    <div
      id={MENU_PANEL_ID}
      className={cn(
        'absolute inset-x-0 top-full border-b border-hairline-dark bg-canvas-dark',
        'motion-safe:transition-[opacity,translate,visibility] motion-safe:duration-(--duration-quick) motion-safe:ease-out',
        open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'
      )}
    >
      <ul className="mx-auto max-w-6xl px-6 py-2">
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
  );
}
