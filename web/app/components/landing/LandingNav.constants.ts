import type { LandingLink, SearchSection } from './Landing.types';

/** The nav's centre links. Two destinations, because the page has two answers
 *  to give: what happens to the money, and what it costs. */
export const NAV_LINKS: LandingLink[] = [
  { label: 'How it works', href: '#how' },
  { label: 'Your money', href: '#money' },
  { label: 'Fees', href: '#fees' },
];

/**
 * The mobile menu's destinations, and it is the SAME LIST plus one — not a
 * second list that drifts.
 *
 * Below `lg` the centre links are `hidden lg:flex`, so between `md` and `lg` the
 * bar keeps no way to reach a section at all; this is what the menu opens onto.
 * (The breakpoint moved from `md` to `lg` when the Personal | Business selector
 * joined the row: brand, selector, search, menu and Sign in already fill a 768px
 * row, and 300px of section links do not fit beside them. Below `lg` the menu is
 * therefore reachable on a tablet as well as a phone, which it was not before.)
 *
 * The four are the three centre links in their own order, plus `Integrations`,
 * which the page ships as a real band (`#partners`) and the centre links never
 * carried: the desktop bar stays two-answer-tight on purpose, and a menu has no
 * such constraint. Built from `NAV_LINKS` so a label edited there cannot leave the
 * menu naming a section the bar has renamed.
 */
export const MENU_LINKS: LandingLink[] = [
  ...NAV_LINKS,
  { label: 'Integrations', href: '#partners' },
];

/**
 * The menu control's accessible name. The control is an icon and nothing else — a
 * three-line glyph beside a brand reads as noise to a screen reader, so the name
 * lives here rather than in a visible label the bar has no room for.
 */
export const MENU_CONTROL_LABEL = 'Menu';

/** The panel's id, so the control can point `aria-controls` at what it opens. */
export const MENU_PANEL_ID = 'landing-nav-menu';

/**
 * Every section the ⌘K palette can jump to.
 *
 * Lives here, next to the links, and is exported so the palette cannot keep its
 * own copy — the palette used to carry a private list of section ids, which
 * silently rots into links that scroll nowhere the moment a section is renamed.
 *
 * THE IDS DID NOT MOVE IN THE REDESIGN (issue #187): `#hero`, `#how`, `#money`,
 * `#fees`, `#partners`, `#open` are the same six bands, recomposed rather than
 * replaced, and both audience variants render all six. The audience is a query
 * parameter, not a route, so a palette jump works the same whichever variant the
 * reader is on — and because it never becomes part of an href here, no link in
 * this file can point at a variant that does not exist.
 *
 * EVERY LABEL NAMES WHAT THE READER LANDS ON. Two entries violated that once: the
 * last band's jump still said `Open it` after the owner retitled the band to
 * `Sign in today`, and `#partners` was missing entirely. Both are fixed here, and
 * the closing band's heading is deliberately the SAME STRING for both audiences
 * (`ClosingSection.constants.ts`) so this label cannot go stale for one of them:
 * only the closing band's button changes with the selector. `Integrations` is the
 * band's own eyebrow, `Your money` and `How it works` are the other two bands'
 * eyebrows, and `Sign in today` its h2 — the strings the reader actually meets —
 * rather than labels invented for the palette. Keywords keep the words people type
 * (`open`, the stack names, `counter`, `code`), because the label is what the
 * palette SHOWS, not all it matches.
 */
export const SEARCH_SECTIONS: SearchSection[] = [
  { id: 'hero', label: 'Home', keywords: 'home top start seti pay name' },
  { id: 'how', label: 'How it works', keywords: 'pay code name link username counter customer balance queue' },
  { id: 'money', label: 'Your money', keywords: 'spend send hold dollars shop person code print' },
  { id: 'fees', label: 'Fees', keywords: 'fee 2% cost price monthly minimum' },
  { id: 'partners', label: 'Integrations', keywords: 'integrations tempo privy bridge stripe stack what seti runs on' },
  { id: 'open', label: 'Sign in today', keywords: 'open start browser sign in claim name testnet' },
];
