import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/site';

/**
 * The public shape of the site, for a crawler.
 *
 * ## What is here
 *
 * Six pages: the landing page, the two a reader reaches from it (`/pricing` and
 * `/how-it-works`, both shipped in #306), and the three legal documents. They are the
 * ones a stranger can reach, read and link to without an account, and a description
 * that is quoted from them is accurate for everyone.
 *
 * ## What is absent, and why
 *
 * - `/m/[handle]` and `/u/[handle]` are a merchant's payment page and a person's
 *   profile. They are per entity, so there is no fixed set of them to enumerate,
 *   and any sample would be a list of real people's handles published as a
 *   sitemap.
 * - `/r/[id]` and `/pay/[id]` carry an opaque id, and a pay page carries a token.
 *   A receipt and a payment request must never be discoverable: an indexed
 *   receipt is a customer's payment readable by any stranger who finds it, and
 *   naming them here is one of the ways that happens.
 * - `/i/[handle]` is an invitation redirect. Nothing to read, nothing to rank.
 * - The whole `/app` tree is behind sign-in, so a crawler that reached it would
 *   be sent to the shell anyway, and what it would have fetched is a customer's
 *   own balances.
 * - `/signin` is a form.
 *
 * ## Absolute URLs
 *
 * A sitemap entry is a URL, not a path, and the origin is not knowable from the
 * request: the route is served from whichever host the deployment is on, and a
 * `localhost` or preview origin baked into a sitemap is a sitemap telling a
 * crawler about a host that is not each entry's own. `SITE_ORIGIN` is the single
 * place this repo answers "what is our host", so it is what is used here.
 *
 * ## No `lastModified`, deliberately
 *
 * The repository holds no trustworthy modification date for these pages. The
 * legal documents have an effective date, but that is the day the terms took
 * effect, not the day the page changed; the landing page has neither. Writing
 * `new Date()` would stamp every entry with the moment of the build, which
 * differs on every deploy and describes the build rather than the content. A
 * crawler that sees a `lastmod` it cannot trust stops using the field for this
 * site altogether, which costs more than leaving it out.
 *
 * `changeFrequency` and `priority` are omitted for the same kind of reason:
 * Google ignores both, and the numbers they take are a scale this repository has
 * no basis for. `priority: 0.8` asserts a relative importance nobody measured.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/pricing', '/how-it-works', '/privacy', '/terms', '/cookies'].map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
  }));
}
