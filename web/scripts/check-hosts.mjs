/**
 * The two hosts stay two hosts (#574).
 *
 * The app answers on `app.seti.live` and the marketing site on `seti.live`, and the
 * pieces that make that true live in four files that nothing else re-reads: the regex
 * that decides what a product path IS, the 301 that moves an old link, the rewrite that
 * serves the app tree on the new host, and the cookie domain that carries an invitation
 * across the boundary.
 *
 * Every one of those fails SILENTLY when it regresses. A redirect that stops firing
 * leaves the app reachable on the old host, so nobody notices. A cookie without
 * `domain` is dropped at the host boundary, so attributed signups stop being attributed
 * with no error on either side. And `/^\/app/` written without the segment guard also
 * matches `/apple`, which teaches search engines a host a marketing page never lived on.
 *
 * So the rules are pinned here, as behaviour where behaviour can be tested: the regex
 * is loaded out of `proxy.ts` and RUN against the paths it has to separate, rather than
 * string-matched for a shape.
 *
 * Run: npm run check:hosts --workspace web (part of `npm run verify`).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(join(here, '..', path), 'utf8');

let failures = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ok  ${name}`);
    return;
  }

  failures += 1;
  console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

const proxy = read('proxy.ts');
const site = read('lib/site.ts');
const invite = read('app/i/[handle]/route.ts');
const inviteApi = read('app/api/invite/route.ts');

// ── the path rule, run rather than pattern-matched ────────────────────────────
const source = proxy.match(/const APP_PATH = (\/[^\n]*\/);/);

if (!source) {
  check('proxy.ts declares the product path rule', false, 'no `const APP_PATH = /…/;`');
} else {
  // The literal is read from our own source, and running it is the point: a regex that
  // merely LOOKS right is what this catches.
  const rule = eval(source[1]);

  // `url.pathname` never carries a query string, so the cases here are paths only.
  // The query survives the redirect because the URL is CLONED from the request, which
  // the next assertion pins.
  for (const path of ['/app', '/app/', '/app/pay', '/app/pay/123', '/app/activity']) {
    check(`the rule claims ${path}`, rule.test(path));
  }

  for (const path of ['/apple', '/apples', '/ap', '/', '/m/handle', '/applied']) {
    check(`the rule leaves ${path} alone`, !rule.test(path));
  }
}

// ── the framework's own paths stay where they are (#576) ──────────────────────
const infraSource = proxy.match(/const INFRA_PATH = (\/[^\n]*\/[a-z]*);/);

if (!infraSource) {
  check('proxy.ts declares the infrastructure path rule', false, 'no `const INFRA_PATH = /…/;`');
} else {
  const infra = eval(infraSource[1]);

  for (const path of [
    '/_next/image',
    '/_next/static/chunks/webpack.js',
    '/_next/static/css/app.css',
    '/api/invite',
    '/favicon.ico',
    '/seti-lockup-friendly.png',
    '/robots.txt',
    '/sitemap.xml',
  ]) {
    check(`the rewrite leaves ${path} alone`, infra.test(path));
  }

  for (const path of ['/pay', '/receive', '/save', '/activity', '/profile', '/app/pay']) {
    check(`the rewrite still claims ${path}`, !infra.test(path));
  }
}

check(
  'the rewrite consults the infrastructure rule',
  /!INFRA_PATH\.test\(url\.pathname\)/.test(proxy),
  'the rewrite no longer excludes /_next/*, /api/* and files'
);

// ── the sign-in page belongs to the app host (#578) ───────────────────────────
const ownedSource = proxy.match(/const APP_OWNED_PATH = (\/[^\n]*\/[a-z]*);/);

if (!ownedSource) {
  check('proxy.ts declares the app-owned root routes', false, 'no `const APP_OWNED_PATH = /…/;`');
} else {
  const owned = eval(ownedSource[1]);

  for (const path of ['/signin', '/signin/']) {
    check(`the sign-in page is app-owned: ${path}`, owned.test(path));
  }

  for (const path of ['/signing', '/sign', '/app/signin']) {
    check(`the rule does not overreach: ${path}`, !owned.test(path));
  }
}

check(
  'the apex sends /signin to the app host',
  /APP_PATH\.test\(url\.pathname\) \|\| APP_OWNED_PATH\.test\(url\.pathname\)/.test(proxy),
  'the redirect does not consult the app-owned rule'
);
check('the app host serves /signin without rewriting it', /!APP_OWNED_PATH\.test\(url\.pathname\)/.test(proxy));

// ── the two movements ─────────────────────────────────────────────────────────
check('the URL is cloned from the request, so the query survives', /request\.nextUrl\.clone\(\)/.test(proxy));
check('seti.live/app 301s to the app host', /NextResponse\.redirect\(url,\s*301\)/.test(proxy));
check('the redirect strips the /app prefix', /replace\(\/\^\\\/app\/,\s*''\)/.test(proxy));
check('the app host rewrites into the /app tree', /NextResponse\.rewrite\(url\)/.test(proxy));
check('the app host is named once, as a constant', /const APP_HOST = 'app\.seti\.live'/.test(proxy));
check('www is treated like the apex', /APEX_HOSTS = new Set\(\['seti\.live', 'www\.seti\.live'\]\)/.test(proxy));
check(
  'every branch carries the security headers',
  (proxy.match(/withSecurityHeaders\(/g) || []).length >= 4,
  'a branch returned a response without the headers'
);

// ── the cookie that has to cross the boundary ─────────────────────────────────
check('a cookie domain is declared', /export const SITE_COOKIE_DOMAIN =/.test(site));
check('the domain is the parent of both hosts', /'\.seti\.live'/.test(site));
check('the invite route sets the cookie with that domain', /domain: SITE_COOKIE_DOMAIN/.test(invite));
check(
  'the invite route also clears with that domain',
  /maxAge: 0,\s*\n\s*\}\);|domain: SITE_COOKIE_DOMAIN,\s*\n\s*maxAge: 0/.test(invite)
);
check('the API clear names the same domain', /domain: SITE_COOKIE_DOMAIN/.test(inviteApi));

// ── where an invitation lands ─────────────────────────────────────────────────
check('the app origin is configuration, not a literal in a route', /export const APP_ORIGIN =/.test(site));
check('the landing keeps the dead-invite flag', /\?invite=not-live/.test(site));
check('development still lands on the /app path', /`\/app\$\{flag\}`/.test(site));
check('the invite route forwards through it', /appInviteLanding\(/.test(invite));

if (failures > 0) {
  console.error(`\ncheck:hosts — ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck:hosts — the app host, the redirect and the invite cookie are intact');
