import { NextResponse, type NextRequest } from 'next/server';
import { securityHeaders } from '@/lib/security-headers';

/**
 * Attach the security headers to every document the app serves, and route the two
 * hosts the site answers on.
 *
 * A proxy rather than a `headers()` block in `next.config.ts`, because the deployed
 * web app is built by vinext and served as a Cloudflare Worker (`wrangler.jsonc`), so
 * the response is assembled at request time. The proxy file convention is the one
 * both runtimes honour, and the headers therefore cannot diverge between the dev
 * server and what ships.
 *
 * ## Routing moved in here (#574), and the note that said it never would is gone
 *
 * This file used to say it touched nothing but headers, because "a proxy that also
 * routed would be a second place routing is decided". The product app now lives on
 * its own host (`app.seti.live`), and that decision has to be made somewhere: vinext
 * GENERATES the Worker entry at build time (`dist/server/wrangler.json`, `main:
 * index.js`), so there is no wrapper entry in this repository to own it, and redirects
 * declared in `next.config.ts` cannot match on the request host. So this is the one
 * place routing is decided, and nothing else in the repo decides it. The old sentence
 * is retired deliberately rather than quietly contradicted.
 *
 * Why the app has its own host at all: on `seti.live/app` any script the landing page
 * loads shares an origin with a signed-in money app, and the session lives in
 * `localStorage`. On a subdomain the isolation is a property of the deployment instead
 * of a convention in code.
 *
 * ## The `/app` prefix is matched as a SEGMENT
 *
 * `^/app(?:\/|$)` and not `startsWith('/app')`: the latter also swallows `/apple`, and
 * a redirect on a marketing path nobody asked about is a 301 that teaches search
 * engines a host the page never lived on. `check:hosts` pins the difference.
 */

const APEX_HOSTS = new Set(['seti.live', 'www.seti.live']);
const APP_HOST = 'app.seti.live';

/** A path that belongs to the product app, matched as a segment. */
export const APP_PATH = /^\/app(?:\/|$)/;

/**
 * The ONE product route that is not under `/app`: the sign-in page (#578).
 *
 * `app/(product)/signin/page.tsx` serves `/signin`, and the session it creates lands in
 * `localStorage`, which is per origin. Served on the apex it signed a reader in on
 * `seti.live` and then dropped them into `app.seti.live` signed out, because the app
 * cannot read another origin's storage. So `/signin` belongs to the app host exactly as
 * `/app/*` does: the apex sends it there, and the app host serves the real route instead
 * of rewriting it into `/app/signin`, which does not exist.
 */
export const APP_OWNED_PATH = /^\/signin(?:\/|$)/;

/**
 * Paths the framework and the route handlers serve THEMSELVES, on any host.
 *
 * These must never be rewritten into the `/app` tree, and the first deploy proved why:
 * `/_next/image` and `/_next/static/*` were rewritten to `/app/_next/...` and answered
 * 404 on `app.seti.live`, so the header's lockup rendered broken and Next's chunks
 * missed (#576). `/api/*` is the same shape from the other direction: `app/api/invite`
 * is served at `/api/invite`, NOT at `/app/api/invite`, so rewriting it would move a
 * route that is already in the right place.
 *
 * The third alternative is a file: a path whose last segment carries an extension is a
 * static asset (`/favicon.ico`, `/seti-lockup.png`, `/robots.txt`, `/sitemap.xml`), and
 * those resolve from the public directory regardless of host.
 */
export const INFRA_PATH = /^\/(?:_next\/|api\/|[^/]+\.[a-z0-9]+$)/i;

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(securityHeaders())) {
    response.headers.set(name, value);
  }

  return response;
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
  const url = request.nextUrl.clone();

  // seti.live/app/anything -> app.seti.live/anything, permanently, query intact.
  // `/signin` goes with it: a session created on the apex is a session the app cannot
  // read (#578).
  if (APEX_HOSTS.has(host) && (APP_PATH.test(url.pathname) || APP_OWNED_PATH.test(url.pathname))) {
    url.host = APP_HOST;
    url.pathname = url.pathname.replace(/^\/app/, '') || '/';

    return withSecurityHeaders(NextResponse.redirect(url, 301));
  }

  // app.seti.live/anything -> the /app tree, without changing the address bar. Only
  // PAGE paths: `/_next/*`, `/api/*`, files and the app's own root routes
  // (`/signin`) keep their own paths, or the framework's assets 404 (#576) and the
  // sign-in page 404s on the host that signs people in (#578).
  if (
    host === APP_HOST &&
    !APP_PATH.test(url.pathname) &&
    !APP_OWNED_PATH.test(url.pathname) &&
    !INFRA_PATH.test(url.pathname)
  ) {
    url.pathname = `/app${url.pathname}`;

    return withSecurityHeaders(NextResponse.rewrite(url));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: '/:path*',
};
