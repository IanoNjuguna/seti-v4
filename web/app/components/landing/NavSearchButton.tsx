import { SearchIcon } from './icons/SearchIcon';
import type { NavSearchButtonProps } from './NavSearchButton.types';

/**
 * The palette trigger, and it is the DESKTOP control — `max-md:hidden` from
 * `md` down.
 *
 * On a phone it used to keep only its icon (the label and the key chip dropped
 * below `sm`), which left the bar holding the mark, this control and `Sign in`,
 * and left the icon-only button with no accessible name at all. Both problems
 * have one cause: the shortcut it advertises cannot be pressed on a phone. So
 * below `md` the control is gone, and the row it was spending goes to the menu
 * the bar needs instead (`LandingNav`); from `md` up, where a keyboard exists,
 * the label and the chip are both shown and the name is on screen.
 *
 * `rounded-md` (12px) — the SURFACE AND CONTROL radius — because this is a
 * control. It carried `rounded-sm` (8px), which is the chip radius: the rule is
 * "surfaces and controls `rounded-md`, chips and badges `rounded-sm`, and
 * circles stay circles", so an 8px control was the odd one out. The `⌘K` chip
 * INSIDE it stays `rounded-sm` — that one really is a badge.
 *
 * `h-11 sm:h-9` puts it at 44px on a touch screen and 36px on a pointer one,
 * which is `{component.button-pill-sm}`'s own ladder (36px, bumped to 44px on
 * mobile) — the doc's chip height, not the 48px control height, and that is
 * deliberate: a search affordance should not stand as tall as the sign-in CTA
 * beside it. The menu control that replaces it on a phone takes the same 44px.
 */
export function NavSearchButton({ onOpen }: NavSearchButtonProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-11 items-center gap-2 rounded-md border border-hairline-dark px-3 text-body-sm text-on-dark-mute transition-colors duration-(--duration-quick) ease-out hover:border-on-dark hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark sm:h-9 max-md:hidden"
    >
      <SearchIcon className="h-4 w-4" />
      <span className="hidden sm:inline">Search</span>
      <span aria-hidden className="hidden rounded-sm bg-surface-elevated px-1.5 py-0.5 text-[10px] font-semibold sm:inline">
        ⌘K
      </span>
    </button>
  );
}
