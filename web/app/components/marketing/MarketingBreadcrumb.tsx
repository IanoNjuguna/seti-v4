import { SITE_ORIGIN } from '@/lib/site';

/**
 * The trail a child page publishes: Home, then this page.
 *
 * ## Why a page needs one at all
 *
 * `layout.tsx` publishes `Organization` and `WebSite` for the whole site, and the landing
 * page adds `FAQPage`. A child page is the one place a crawler has to be told where it sits:
 * `/pricing` read on its own is a page about a fee, and the breadcrumb is what makes it a
 * page about a fee ON seti.live, one level down from a home that says what the product is.
 * The search layer's table lists `BreadcrumbList` under "child pages" for exactly that.
 *
 * ## Why the URLs are absolute and built here
 *
 * A `BreadcrumbList` is compared across documents, so its `item` values are identities like
 * a JSON-LD `@id`: a relative path would resolve against whichever host served the page.
 * `SITE_ORIGIN` is the one place this repo answers "what is our host", and the same constant
 * already builds the sitemap and the merchant links.
 *
 * ## Why the label is passed in, not derived from the path
 *
 * `/pricing` is the route; "What it costs" is what a person calls it. The page that owns the
 * words passes the words, and this component never invents one from a slug, which is how a
 * trail ends up saying "how-it-works" to a reader.
 */
export function MarketingBreadcrumb({ path, label }: { path: string; label: string }) {
  const trail = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_ORIGIN}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: label,
        item: `${SITE_ORIGIN}${path}`,
      },
    ],
  };

  // A constant assembled at render time from two strings this repo owns, never user input,
  // which is why the raw HTML interpolation is safe here; the same reasoning as the graph in
  // `app/layout.tsx`.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(trail) }} />;
}
