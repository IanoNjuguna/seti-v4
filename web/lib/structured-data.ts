import { SITE_ORIGIN } from '@/lib/site';

/**
 * The machine-readable account of what Seti IS, rendered once from the root
 * layout as a single `@graph`.
 *
 * This exists because the page answers "what is Seti" only in prose. An
 * assistant asked that question needs a named entity to hang facts on: a name,
 * an origin, a scope. Without one it summarises scraped text and attributes the
 * summary to nothing, so the answer drifts with whichever paragraph it happened
 * to read.
 *
 * The disambiguators are deliberate. "Seti" is also the SETI Institute, so a
 * bare Organization named Seti invites a model to merge the two. `description`
 * says what the product is and `areaServed` says where it operates; two
 * independent signals that this is a shop-payments company in Kenya rather than
 * a telescope programme.
 *
 * Ids are absolute, built from SITE_ORIGIN. A JSON-LD `@id` is an identity, not
 * a link: two documents have to spell it the same way for the entities to join,
 * and a relative reference would resolve against whatever host served the page.
 */

/**
 * `sameAs` is deliberately absent, and not by oversight. sameAs asserts that
 * another profile speaks for this organization. We do not run a profile we can
 * point at, and inventing one would be a false entity claim that a search
 * engine then has to reconcile, which is worse than saying nothing.
 */
export const organizationSchema: Record<string, unknown> = {
  '@type': 'Organization',
  '@id': `${SITE_ORIGIN}/#organization`,
  name: 'Seti',
  url: SITE_ORIGIN,
  logo: `${SITE_ORIGIN}/seti-lockup.png`,
  description: 'Seti is a payments app for Kenyan shops and traders.',
  areaServed: {
    '@type': 'Country',
    name: 'Kenya',
  },
};

/**
 * The site entity. `publisher` references the organization's `@id` instead of
 * repeating the organization, because the reference is what lets a consumer
 * read the two nodes as one graph: this site is published by that organization,
 * not by a lookalike with the same name.
 */
export const websiteSchema: Record<string, unknown> = {
  '@type': 'WebSite',
  '@id': `${SITE_ORIGIN}/#website`,
  name: 'Seti',
  url: SITE_ORIGIN,
  publisher: {
    '@id': `${SITE_ORIGIN}/#organization`,
  },
  inLanguage: 'en-KE',
};

/**
 * Both nodes, in the order the `@graph` lists them: the organization first,
 * because the site's publisher points back at it.
 */
export const siteSchemas: Record<string, unknown>[] = [organizationSchema, websiteSchema];
