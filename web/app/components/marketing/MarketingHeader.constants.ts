import type { MarketingLink } from './MarketingHeader.types';

/** Where the mark goes: home, from every route this shell wraps. */
export const HEADER_HOME_HREF = '/';

/** The bar's accessible name. One nav per page, and it is not the footer's. */
export const HEADER_NAV_LABEL = 'Main';

/**
 * The bar's one action. `Sign in` is the landing nav's own label for the same destination,
 * so the front door is called the same thing from every route.
 */
export const HEADER_SIGN_IN_LABEL = 'Sign in';

/**
 * The bar's centre links: the landing bar's arrangement over this shell's own destinations
 * (#586).
 *
 * THE LANDING BAR'S LINKS ARE FRAGMENTS (`#how`, `#money`, `#fees`) of the page under it.
 * These routes are separate documents, so the same three ideas have to be addresses:
 * what it costs, how it works, and the converter. Same reading order, same slot in the
 * row, same type — but nothing that would scroll to nothing on `/pricing`.
 *
 * `Convert` comes first because it is the page a stranger arrives for and the only one
 * the landing bar does not otherwise point at.
 */
export const HEADER_LINKS: MarketingLink[] = [
  { label: 'Convert', href: '/convert' },
  { label: 'What it costs', href: '/pricing' },
  { label: 'How it works', href: '/how-it-works' },
];
