import type { LandingLink } from './Landing.types';

export const FOOTER_LINKS: LandingLink[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Cookies', href: '/cookies' },
];

/**
 * The copyright's year.
 *
 * IT COMES FROM THE BUILD, NOT FROM A CLOCK. It used to be `new Date().getFullYear()`
 * read once at module scope, on the argument that a value computed at module scope is
 * worked out once in the server runtime and serialised into the HTML, so no visitor's
 * clock could disagree with it. That argument holds for `next build` and fails for the
 * bundle the site actually ships: under `build:vinext` the expression is kept as an
 * expression and evaluated when the chunk runs, and the deployed Worker's clock
 * answered 0, which is why the live footer read "© 1970 Seti" (#270).
 *
 * So `vite.config.ts` stamps `__SETI_BUILD_YEAR__` at build time and this reads the
 * stamp. The fallback exists for the paths that do not go through Vite (`next dev`, a
 * bare `next build`), where the identifier is undefined and the clock is the browser's
 * or the dev server's own — correct in both cases, and never the deployed render.
 *
 * KEEP THE FALLBACK GUARDED BY `typeof`. A bare reference to an identifier the bundler
 * did not define is a ReferenceError; `typeof` on an undeclared name is not.
 */
declare const __SETI_BUILD_YEAR__: string | undefined;

const COPYRIGHT_YEAR =
  typeof __SETI_BUILD_YEAR__ === 'string' ? __SETI_BUILD_YEAR__ : String(new Date().getFullYear());

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
