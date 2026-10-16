import type { LandingLink } from './Landing.types';

export const FOOTER_LINKS: LandingLink[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Cookies', href: '/cookies' },
];

/**
 * The copyright's year, read from the clock ONCE, at module scope.
 *
 * The line this replaces ("© Seti. Made in Thika, Kenya.") refused a year
 * outright: `new Date()` computed during a render is a hydration defect here,
 * because the server renders it with its own clock and a visitor either side of
 * midnight on 31 December hydrates a different string. That is true of a year
 * computed in a render that also runs in the browser, which is why this one is
 * not. This module is imported only by `LandingFooter`, the footer is a server
 * component, and nothing below it crosses a `'use client'` boundary, so the
 * value is worked out once in the server runtime and serialised into the HTML.
 * On the prerendered landing page that means build time: the year advances with
 * the next deploy, not at midnight, and no literal is typed here that rots in
 * January.
 *
 * KEEP IT THAT WAY. The moment anything under a `'use client'` boundary imports
 * this file, the browser re-evaluates it with the visitor's clock and the
 * mismatch above is back.
 */
const COPYRIGHT_YEAR = new Date().getFullYear();

/** The footer's left: who this is, and the year the page was built. */
export const FOOTER_COPYRIGHT = `© ${COPYRIGHT_YEAR} Seti`;

/**
 * The footer's centre, and the page's last word on where this is made.
 *
 * It sits on the band's own centre line: a three-column grid, not the
 * `justify-between` row its ancestor lived in, where the middle item's position
 * depended on how wide the two outer items happened to be and so floated
 * wherever the links pushed it. It keeps the quiet register, `body-sm` in
 * `on-dark-mute` at regular weight, so it reads as the centre line rather than
 * as a third column competing with the legal links beside it.
 *
 * The old note read "Made in Thika, Kenya."; the owner asked for "Made in
 * Thika", so the country is out of the visible copy (it is still in the page's
 * metadata and throughout `app/legal/`).
 */
export const FOOTER_ORIGIN = 'Made in Thika';
