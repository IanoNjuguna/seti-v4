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
 * Below `md` the centre links are `hidden md:flex`, so the bar keeps no way to
 * reach a section at all; this is what the menu opens onto. The four are the
 * three centre links in their own order, plus `Integrations`, which the page
 * ships as a real band (`#partners`) and the centre links never carried: the
 * desktop bar stays two-answer-tight on purpose, and a menu has no such
 * constraint. Built from `NAV_LINKS` so a label edited there cannot leave the
 * menu naming a section the bar has renamed.
 */
export const MENU_LINKS: LandingLink[] = [
  ...NAV_LINKS,
  { label: 'Integrations', href: '#partners' },
];

/**
 * The menu control's accessible name. The control is an icon and nothing else —
 * a three-line glyph beside a brand reads as noise to a screen reader, so the
 * name lives here rather than in a visible label the bar has no room for.
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
 * EVERY LABEL NAMES WHAT THE READER LANDS ON. Two entries violated that: the
 * last band's jump still said `Open it` after the owner retitled the band to
 * `Sign in today`, so the palette promised a word the band no longer said; and
 * `#partners` was missing from the list entirely, so the palette could not reach
 * the one band that states what Seti runs on. Both are fixed here. `Integrations`
 * is the band's own eyebrow, `Sign in today` its h2 — the two strings the reader
 * actually meets — rather than a label invented for the palette. Keywords keep
 * the words people type (`open`, the stack names), because the label is what the
 * palette SHOWS, not all it matches.
 */
export const SEARCH_SECTIONS: SearchSection[] = [
  { id: 'hero', label: 'Home', keywords: 'home top start seti' },
  { id: 'how', label: 'How it works', keywords: 'pay code name link customer balance queue' },
  { id: 'money', label: 'Your money', keywords: 'spend send hold dollars shop person' },
  { id: 'fees', label: 'Fees', keywords: 'fee 2% cost price monthly minimum' },
  { id: 'partners', label: 'Integrations', keywords: 'integrations tempo privy bridge stripe stack what seti runs on' },
  { id: 'open', label: 'Sign in today', keywords: 'open start browser wallet sign in testnet' },
];
