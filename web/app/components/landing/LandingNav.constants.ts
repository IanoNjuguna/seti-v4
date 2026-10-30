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
 * (The breakpoint is `lg` rather than `md` because brand, Search, Menu and Sign in
 * fill a 768px row and 300px of section links do not fit beside them. It moved from
 * `md` to `lg` when the Personal | Business selector joined the row and stayed
 * there once the selector left, because the row it leaves is still too narrow.)
 *
 * The five are the three centre links in their own order, plus `Integrations` and
 * `What we refuse`, which the page ships as real bands (`#partners`, `#refusals`)
 * and the centre links never carried: the desktop bar stays two-answer-tight on
 * purpose, and a menu has no such constraint. Built from `NAV_LINKS` so a label
 * edited there cannot leave the menu naming a section the bar has renamed.
 */
export const MENU_LINKS: LandingLink[] = [
  ...NAV_LINKS,
  { label: 'Integrations', href: '#partners' },
  { label: 'What we refuse', href: '#refusals' },
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
 * replaced, and the page renders all six. `#refusals` joined them
 * after the redesign as a seventh band (#133). The page has one reading now — the
 * Personal | Business selector and its `?for=` parameter are gone — so every jump
 * lands on a band that is on the page, and no link in this file can point at a
 * variant that does not exist.
 *
 * EVERY LABEL NAMES WHAT THE READER LANDS ON. Two entries violated that once: the
 * last band's jump still said `Open it` after the owner retitled the band to
 * `Sign in today`, and `#partners` was missing entirely. Both are fixed here. The
 * closing band's heading is the string (`ClosingSection.constants.ts`) and the band
 * renders that same constant, so this label cannot go stale. `Integrations` is the
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
  {
    id: 'refusals',
    label: 'What we refuse',
    keywords: 'refuse custody hold money account signup cards bank transfer limit not do',
  },
  { id: 'open', label: 'Sign in today', keywords: 'open start browser sign in claim name testnet' },
];
