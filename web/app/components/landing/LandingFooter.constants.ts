import type { FooterFact, FooterIndexRow } from './LandingFooter.types';
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

/** The footer's year stamp. `© 2026 Seti`. */
export const FOOTER_COPYRIGHT = `© ${COPYRIGHT_YEAR} Seti`;

/**
 * Where this is made, and the page's last word on it.
 *
 * The old note read "Made in Thika, Kenya."; the owner asked for "Made in Thika", so the
 * country is out of the visible copy (it is still in the page's metadata and throughout
 * `app/legal/`).
 */
export const FOOTER_ORIGIN = 'Made in Thika';

/**
 * The chain a payment settles on. It is in the rail rather than in a claim, because
 * "built on Tempo" is a fact a reader can check and does not need a paragraph.
 */
export const FOOTER_NETWORK = 'Tempo';

/**
 * The rail's one line: year, origin, chain, separated by middots.
 *
 * A `·` and not a hairline between them: three items this short want one baseline, and
 * three rules would make the rail read as a table. No clock is read here — see
 * `FOOTER_COPYRIGHT`.
 */
export const FOOTER_COLOPHON = `${FOOTER_COPYRIGHT} · ${FOOTER_ORIGIN} · ${FOOTER_NETWORK}`;

/**
 * The footer's statement: the page's strongest true sentence, in two lines a person
 * split rather than a CSS max-width.
 *
 * THE CLAIM IS THE ARCHITECTURE, NOT THE COPY. v1 is non-custodial: a payment runs from
 * the customer's wallet to the merchant's own wallet, and the backend holds no key that
 * can move either. The sentence was the hero's proof line until #288 removed it from
 * there, and the note that recorded the removal said the claim needed "a home that is
 * not the hero". This is that home: a footer is where a reader goes to check what a
 * company actually promises, so it belongs above the index, in display type, as the band's
 * first movement.
 *
 * Two lines of four to six words each, so `text-balance` has nothing to correct and the
 * break falls where the thought breaks (`landing-page-design` B5).
 */
export const FOOTER_STATEMENT: readonly string[] = [
  'The money lands in your wallet.',
  'Seti never holds it.',
];

/**
 * The ledger: three money questions, three one-word answers.
 *
 * EVERY ANSWER IS A FACT THE REPO BACKS, which is why they are this blunt:
 *
 *   - the fee is 2% flat, no floor and no cap, funded by the customer inside their own
 *     payment (`backend/src/services/fees.ts` is the source of truth);
 *   - there is no monthly fee and no minimum (`FaqSection.constants.ts`);
 *   - Seti never holds the money — v1 is non-custodial, and the backend holds no key
 *     that could move it.
 *
 * "Never" is the point of the set. It says the statement beside it a second time, in the
 * register a reader checking a footer is already in.
 */
export const FOOTER_FACTS: readonly FooterFact[] = [
  { label: 'Fee', value: 'Flat' },
  { label: 'Monthly fee', value: 'None' },
  { label: 'Holds your money', value: 'Never' },
];

/**
 * The page's table of contents, at the foot of the page.
 *
 * EVERY ID IS A BAND'S OWN ID and every label is the word that band uses for itself, so
 * a row cannot point at a section that has been renamed or is not rendered. `questions`
 * is the one id that is not in `SEARCH_SECTIONS` — the ⌘K palette stays six bands by
 * decision (`LandingNav.constants.ts`) — and it is a real band (`FaqSection.tsx`).
 *
 * The hero and the closing band are out: a reader at the foot of the page does not need
 * a link to the top of it or to the button immediately above.
 */
export const FOOTER_INDEX: readonly FooterIndexRow[] = [
  { id: 'how', label: 'How it works' },
  { id: 'money', label: 'Your money' },
  { id: 'fees', label: 'Fees' },
  { id: 'questions', label: 'Questions' },
];
