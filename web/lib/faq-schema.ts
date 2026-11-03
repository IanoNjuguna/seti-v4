import { FAQ_COPY } from '@/app/components/landing/FaqSection.constants';
import { SITE_ORIGIN } from '@/lib/site';

/**
 * The `FAQPage` node for the questions band, read out of the band's own constant.
 *
 * THE QUESTIONS AND ANSWERS ARE NOT TYPED HERE. They come from `FAQ_COPY`, the same
 * object `FaqSection` renders, so there is exactly one copy of every question in the
 * repository: a copy edit changes the visible band and the structured data together, and
 * the two cannot drift into the state where the page says one thing and a search result
 * quotes another. This is why the file imports a component's constants rather than
 * keeping a schema-shaped list: the schema is a projection of the copy, not a second
 * account of it.
 *
 * IDs are absolute and built from `SITE_ORIGIN`, like every other node in
 * `web/lib/structured-data.ts`: a JSON-LD `@id` is an identity, and two documents have to
 * spell it the same way for the entities to join. `url` is the page the FAQ is ON, which
 * is the home page, and the FAQ has no URL of its own.
 *
 * `acceptedAnswer.text` is the visible answer, byte for byte. Google's FAQ guidance asks
 * for the answer as plain text, which is what these are: one or two sentences, no markup,
 * no markup-ish quotes around them.
 */
export const faqPageSchema: Record<string, unknown> = {
  '@type': 'FAQPage',
  '@id': `${SITE_ORIGIN}/#faq`,
  url: SITE_ORIGIN,
  mainEntity: FAQ_COPY.items.map((entry) => ({
    '@type': 'Question',
    name: entry.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: entry.answer,
    },
  })),
};

/**
 * The nodes this module contributes to the root layout's `@graph`, in that order.
 *
 * An array rather than a bare object so `siteSchemas` appends it with a spread: adding a
 * second document-level node later (a `BreadcrumbList`, an `ItemList`) does not change
 * the shape the layout consumes.
 */
export const faqSchemas: Record<string, unknown>[] = [faqPageSchema];
