import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/site';

/**
 * What a crawler may read.
 *
 * ## The one thing that matters
 *
 * Nothing here blocks the crawlers an assistant uses. Being read and quoted by a
 * model is the point of this site, not a cost of it: someone who asks what Seti
 * costs and where the money goes should get an answer taken from these pages.
 * So `allow` covers the whole origin and the disallow list is only the surfaces
 * no crawler has business in: the signed-in app, the sign-in shell, the API, and
 * the opaque receipt, payment request and invitation routes.
 *
 * ## Why `disallow` and not just an absent sitemap
 *
 * `app/sitemap.ts` already leaves these routes out. That only hides them from a
 * crawler that reads the sitemap first. Robots is the other door: a link shared
 * in a public place, a search result, a referrer in a log. An indexed receipt is
 * a stranger reading a customer's payment, so the routes are named here as well.
 *
 * ## Why a generated file rather than a static one
 *
 * It replaces a comment-only Cloudflare file, which said nothing a crawler could
 * act on and named no sitemap. Here the sitemap URL is built from
 * `SITE_ORIGIN`, the single place this repo answers "what is our host", so the
 * sitemap it points at cannot be on a different host from the pages listed in it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app/', '/signin', '/api/', '/r/', '/pay/', '/i/'],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
