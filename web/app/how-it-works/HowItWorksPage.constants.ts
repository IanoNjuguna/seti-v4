import type { Metadata } from 'next';
import type {
  MarketingCloseLink,
  MarketingMastheadCopy,
  MarketingRow,
  MarketingStep,
} from '../components/marketing';

/** Where this page lives: one spelling of the path, used by the canonical and the head. */
export const HOW_IT_WORKS_PATH = '/how-it-works';

const TITLE = 'How a customer pays you in dollars in Kenya · Seti';

const DESCRIPTION =
  'Your customer scans your code or types your name, and the dollars land in your own balance. What they need, what it costs, and what happens next.';

/**
 * The head, and every length in it is the dictated one.
 *
 * TITLE 50, DESCRIPTION 145, both inside the 45 to 60 and 140 to 155 the search layer holds
 * to (`seo-and-ai-search`). The title carries the country, which is the rule that keeps a
 * page from being found for the space institute instead of for this.
 *
 * NO `robots` FIELD: this is a page written to be found and quoted. The product surfaces are
 * hidden because they need an account; nothing here does.
 *
 * `openGraph` AND `twitter` ARE RESTATED. Next replaces these objects whole rather than
 * merging them a field at a time, so without them this route would offer the landing's
 * preview card. The card restates the title and the description rather than inventing a
 * shorter variant: a link that says one thing and opens another reads as a bait.
 */
export const HOW_IT_WORKS_METADATA: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: HOW_IT_WORKS_PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: HOW_IT_WORKS_PATH },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

/** The masthead: the dictated h1, and the one sentence about where the money sits. */
export const HOW_IT_WORKS_MASTHEAD: MarketingMastheadCopy = {
  title: 'How a dollar payment works.',
  lede: 'Your customer pays in three taps, and the money never sits with us.',
};

/**
 * The three moves, in order, in the masthead under the lede.
 *
 * EVERY STEP IS TRUE OF THE SHIPPED PRODUCT and none of them is a claim the app cannot keep:
 * the page is the merchant's own URL (`/m/<handle>`, unauthenticated so a stranger can see
 * who they are paying), the amount is shown before anything is asked, and the dollars leave
 * the payer's balance for the payee's with the 2% riding inside the same payment
 * (`backend/src/services/fees.ts`). No step mentions a card, a bank or a queue.
 */
export const STEPS: MarketingStep[] = [
  {
    index: '1',
    title: 'They open your page',
    detail: 'Your code on the counter, your name in the app, or a link you send.',
  },
  {
    index: '2',
    title: 'They see who they are paying',
    detail: 'Your name and the amount, before anything is asked of them.',
  },
  {
    index: '3',
    title: 'They pay from their own balance',
    detail: 'The dollars leave their balance and land in yours, with the 2% included.',
  },
];

/** The band's dictated h2, promoted to the heading: nothing else names the band. */
export const LANDS_EYEBROW = 'What lands where';

/**
 * What arrives, and what does not, in the reader's own terms.
 *
 * THE FIRST ROW IS THE ONE THAT ANSWERS THE DOUBT: a merchant who has been paid by an app
 * before expects a pending figure and a wait. Nothing is pending here and nothing waits, and
 * the row says so in two sentences rather than one adjective.
 */
export const LANDS_ROWS: MarketingRow[] = [
  {
    title: 'Your balance, in dollars',
    detail: 'Not a pending figure. It is yours as soon as the payment is confirmed.',
  },
  {
    title: 'The 2%',
    detail: 'Your customer pays it inside the same payment. You keep the ticket.',
  },
  {
    title: 'Nothing in the middle',
    detail: 'We never hold your money, and there is no queue to wait in.',
  },
];

export const FAILURES_EYEBROW = 'When something goes wrong';

/**
 * The three things that can go wrong, and what happens to the money in each.
 *
 * These are the objections a merchant raises at the counter, so they are answered here rather
 * than in a support page: the amount, the code, and the payment that does not complete. All
 * three keep the reader's money where it was, and none of them describes a fee for a failure.
 */
export const FAILURE_ROWS: MarketingRow[] = [
  {
    title: 'A wrong amount',
    detail: 'Nothing is deducted until your customer confirms the figure.',
  },
  {
    title: 'A code that will not scan',
    detail: 'They type your name instead.',
  },
  {
    title: 'A payment that fails',
    detail: 'The money stays in their balance, and the app says so.',
  },
];

/** The sibling route, in the close: the page behind the reader's next question. */
export const SIBLING_LINK: MarketingCloseLink = {
  label: 'What it costs',
  href: '/pricing',
};
