import type { MarketingRow } from '../components/marketing';

/**
 * What `/convert` says, and the head it carries (#586).
 *
 * ONE PLACE FOR THE PAGE'S COPY, so a copy change is a constants change and
 * `check:convert-page` reads the same strings the page prints.
 *
 * THE MASTHEAD IS THE h1 ALONE (#588). Its lede was cut: the headline says what the page is
 * for and the calculator under it is the answer, so a sentence in between restated the
 * headline rather than adding to it.
 *
 * THE ATTRIBUTION IS NOT DECORATION. Every figure is the Central Bank of Kenya's indicative
 * rate for a named day, and the Bank describes that number as the average buying and selling
 * rates of the major participants at the open: indicative, and not a quote anyone is obliged
 * to honour. That is said ONCE, under the figure itself (`NOT_A_QUOTE`, in
 * `ConvertCalculator.constants.ts`), where the number is — the band's own "what it is not"
 * row was cut with the lede (#588), because a converter's reader meets the caveat beside the
 * rate, not two bands below it.
 */

/** Where this page lives. One spelling, used by the canonical and the sitemap. */
export const CONVERT_PATH = '/convert';

/** The h1, and nothing under it (#588). */
export const MASTHEAD = {
  title: 'What a dollar is worth today.',
} as const;

export const ABOUT: { eyebrow: string; rows: MarketingRow[] } = {
  eyebrow: 'The rate, and what it is',
  rows: [
    {
      title: 'Who publishes it',
      detail:
        'The Central Bank of Kenya, every Kenyan business day, as an indicative rate for the shilling against the dollar.',
    },
    {
      title: 'What it is made of',
      detail:
        'The average buying and selling rates of the major participants in the foreign exchange market at the open of trade. Since January 2024 the Bank publishes one mean and no bid or ask.',
    },
  ],
};

export const CLOSE_LINK = { href: '/pricing', label: 'What it costs' } as const;

/**
 * The head.
 *
 * TITLE 60, DESCRIPTION 152, both inside the lengths the search layer holds to
 * (`seo-and-ai-search`: 45 to 60 and 140 to 155), so neither is a truncation risk. The
 * title carries the category AND the country, because "seti" alone returns the space
 * institute, and names the publisher because that is the one thing this page has that a
 * dozen currency converters do not.
 *
 * `openGraph` and `twitter` are restated rather than inherited: Next replaces these
 * objects whole, so a route that set only the title would inherit the landing page's card
 * and offer a link that describes a different page.
 */
const TITLE = 'Convert OUSD and pathUSD to shillings at CBK rate · Seti';
const DESCRIPTION =
  'Convert the stablecoins Seti takes into Kenyan shillings at the Central Bank of Kenya’s indicative rate for the day. The same rate a payment is priced at.';

export const CONVERT_METADATA = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CONVERT_PATH },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CONVERT_PATH,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
} as const;
