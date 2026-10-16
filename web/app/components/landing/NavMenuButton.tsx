import { MenuIcon } from './icons/MenuIcon';
import { MENU_CONTROL_LABEL } from './LandingNav.constants';
import type { NavMenuButtonProps } from './NavMenuButton.types';

/**
 * The mobile menu's control, and the bar's third object after the brand and the
 * sign-in CTA.
 *
 * IT IS THE SEARCH CONTROL'S OWN GEOMETRY, because on a phone it takes that
 * control's place: `h-11` (44px, the touch floor), `rounded-md` — the control
 * radius, not a pill — a `hairline-dark` edge, and the icon at the bar's own
 * ink. The bar therefore keeps one control language and one control size across
 * the breakpoint; only which control stands there changes.
 *
 * WHAT IT REPLACES, AND WHY THAT IS ONE DECISION. Below `md` the ⌘K control is
 * `max-md:hidden` (`NavSearchButton`): a keyboard-shortcut affordance is noise on
 * a phone, where the shortcut cannot be pressed at all, and the row it was
 * spending is the row the menu needs. Hiding that control and adding this one is
 * a single trade, not two changes.
 *
 * `aria-expanded` + `aria-controls` are what make it a disclosure rather than a
 * mystery icon; the accessible name comes from `MENU_CONTROL_LABEL`, since the
 * glyph carries none.
 */
export function NavMenuButton({ open, onToggle, panelId, buttonRef }: NavMenuButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={MENU_CONTROL_LABEL}
      className="flex h-11 items-center rounded-md border border-hairline-dark px-3 text-on-dark-mute transition-colors duration-(--duration-quick) ease-out hover:border-on-dark hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
    >
      <MenuIcon className="h-5 w-5" />
    </button>
  );
}
