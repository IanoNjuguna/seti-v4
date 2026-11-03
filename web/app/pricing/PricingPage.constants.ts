import type { Metadata } from 'next';
import type {
  MarketingCloseLink,
  MarketingMastheadCopy,
  MarketingPriceLine,
  MarketingRow,
  MarketingStatement,
} from '../components/marketing';

/** Where this page lives: one spelling of the path, used by the canonical and the head. */
export const PRICING_PATH = '/pricing';

/**
 * The head, and every length in it is the dictated one.
 *
 * TITLE 47, DESCRIPTION 146, both inside the 45 to 60 and 140 to 155 the search layer holds
 * to (`seo-and-ai-search`), so neither is a truncation risk. The description ends on the
 * arithmetic — `KES 25 on KES 1,250` — which is 2% of the ticket and the one figure a reader
 * can check without opening the page.
 *
 * NO `robots` FIELD. `/pricing` is a page written to be found: the fee, the comparison and
 * the refusals are what a reader searches for by name. The site hides the product surfaces
 * (`/app/*`, `/signin`, `/r/*`, `/pay/*`, `/u/*`) because they need an account; this one has
 * nothing to hide behind a session.
 *
 * THE TITLE NAMES KENYA. The first cut of this line was "What Seti costs: 2% a payment, no
 * monthly fee", which is the price and the product and no place at all, and the search
 * layer's own rule is that every title carries category plus country because "seti" alone
 * returns the space institute. A price page that cannot be found by someone looking for one
 * in Kenya is a page about our fee, not theirs.
 *
 * `openGraph` AND `twitter` ARE RESTATED, not inherited. Next replaces these objects whole
 * rather than merging them field by field, so a route that sets only `title` and
 * `description` would inherit the landing's preview card and offer a link that says
 * something different from the page it opens. `card` therefore comes with them.
 */
const TITLE = '2% payments in Kenya, and no monthly fee · Seti';

const DESCRIPTION =
  '2% of each payment, paid by your customer in the same payment. No monthly fee, no minimum, and how that compares with a till. KES 25 on KES 1,250.';

export const PRICING_METADATA: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PRICING_PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: PRICING_PATH },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

/** The masthead: the dictated h1, and the sentence that does the arithmetic out loud. */
export const PRICING_MASTHEAD: MarketingMastheadCopy = {
  title: '2% of each payment, and nothing monthly.',
  lede: 'A KES 1,250 payment costs your customer KES 1,275, and you keep KES 1,250.',
};

/**
 * The price list, in the masthead under the lede.
 *
 * EVERY FIGURE IS KES. The product holds dollars and the reader prices things in shillings,
 * so the ticket is quoted in shillings and the percent is the same 2% either way.
 */
export const PRICE_LINES: MarketingPriceLine[] = [
  {
    label: '2% of each payment',
    detail: 'Your customer pays it inside the same payment, so you keep the ticket.',
  },
  {
    label: 'No monthly fee',
    detail: 'Holding dollars costs you nothing, whether you take one payment or a thousand.',
  },
  {
    label: 'No minimum',
    detail: 'A KES 50 payment is charged the same 2%.',
  },
];

/** The band's dictated h2, and it is the marker as well: no second line says it again. */
export const COMPARISON_EYEBROW = 'How that compares';

/**
 * The comparison, with each measurement's date INSIDE its own sentence.
 *
 * The date stays in the sentence rather than moving to a footnote under the band: a tariff
 * that changes without notice has to carry the day it was read, next to the figure, or the
 * figure reads as current forever. On a KES 1,250 ticket a till keeps KES 1,243.12 (0.55%,
 * under the KES 200 cap) and we keep KES 1,250 while the customer pays KES 1,275.
 */
export const COMPARISON_ROWS: MarketingRow[] = [
  {
    title: 'A Lipa na M-Pesa till',
    detail:
      '0.55% to the merchant, capped at KES 200, and payments up to KES 500 are free. Measured 2026-11-01.',
  },
  {
    title: 'Sending money to Kenya',
    detail:
      '4.9% on average across cash, cards and banks, and about 0.87% on the cheapest digital route. Measured 2026-11-01.',
  },
  {
    title: 'On a KES 1,250 payment',
    detail:
      'You keep KES 1,250 with us, against KES 1,243.12 on a till. Your customer pays KES 1,275 instead of KES 1,250.',
  },
];

export const REFUSALS_EYEBROW = 'What we are not';

/**
 * What the numbers above cost us, said plainly.
 *
 * THIS BAND IS THE PRICE OF PRINTING THE TWO FIGURES ABOVE IT. A page that quotes a till's
 * 0.55% and the corridor's 0.87% and stops has implied it wins both comparisons, and a
 * Kenyan reader checks that in thirty seconds. Two of the three sentences concede the price
 * outright; the third says what is actually being sold instead, in the voice skill's words
 * and without naming how the money moves.
 */
export const REFUSALS: MarketingStatement[] = [
  {
    text: 'We are not the cheap way to take a local shilling. M-Pesa is, and under KES 500 it costs your customer nothing.',
  },
  {
    text: 'We are not the cheapest way to send money to Kenya. Wise is.',
  },
  {
    text: 'What you get is the property, not the price: the money arrives in dollars, whole, and nobody holds it in between.',
  },
];

/**
 * The sibling route, in the close. The two pages are halves of one argument, and a reader
 * who has just finished the price is the likeliest reader of the mechanic.
 */
export const SIBLING_LINK: MarketingCloseLink = {
  label: 'How a payment works',
  href: '/how-it-works',
};
