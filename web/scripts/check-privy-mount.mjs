#!/usr/bin/env node
/**
 * `npm run check:privy-mount` — one Privy instance for the whole product.
 *
 * ## What broke without this (#249)
 *
 * Sign-in and the app each mounted `<PrivyAppProvider>`, one per route. Privy keeps
 * its session inside the instance. The person signed in on the sign-in page's
 * instance, then the move to `/app/onboarding` unmounted it and its teardown posted
 * its own refresh token to `POST /api/v1/sessions/logout`, revoking the session it
 * had created 200 ms earlier. The app's instance booted with nothing, so no wallet
 * could sign and no new account could claim a name.
 *
 * The failure was invisible to every existing check because every existing check
 * renders components. The bug lived in WHICH TREE mounts the SDK, so this reads the
 * tree. It is a small check on purpose: it asserts one shape, the shape whose absence
 * cost every new account an onboarding.
 *
 * ## The shape
 *
 *   web/app/(product)/layout.tsx   the only place the provider is rendered
 *   web/app/(product)/signin/…     inside it, not mounting its own
 *   web/app/(product)/app/…        inside it, not mounting its own
 *   web/app/page.tsx               marketing, ships no SDK
 *
 * Route groups do not change URLs, so `/signin` and `/app` are unaffected.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const APP = path.join(ROOT, 'app');

let passed = 0;
const failures = [];

function ok(claim) {
  passed += 1;
  console.log(`ok    ${claim}`);
}

function fail(claim, detail) {
  failures.push(claim);
  console.log(`FAIL  ${claim}${detail ? `  (${detail})` : ''}`);
}

function check(claim, condition, detail) {
  if (condition) ok(claim);
  else fail(claim, detail);
}

function read(rel) {
  const abs = path.join(ROOT, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

/** Every .ts/.tsx under a directory, skipping node_modules and build output. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue;
    const abs = path.join(dir, entry);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(abs);
  }
  return out;
}

// ---- 1. exactly one provider in the whole of web/
const sources = walk(ROOT).filter((p) => !p.includes(`${path.sep}scripts${path.sep}`));
const providerFiles = sources.filter((p) => readFileSync(p, 'utf8').includes('<PrivyProvider'));
check(
  'the SDK is instantiated in exactly one file',
  providerFiles.length === 1,
  providerFiles.map((p) => path.relative(ROOT, p)).join(', ') || 'none found'
);
check(
  'and that file is the provider component',
  providerFiles.length === 1 && path.relative(ROOT, providerFiles[0]) === 'components/providers/PrivyAppProvider.tsx',
  providerFiles.length === 1 ? path.relative(ROOT, providerFiles[0]) : 'ambiguous'
);

// ---- 2. the provider is RENDERED in exactly one place, and it is the group layout
const mountFiles = sources.filter((p) => /<PrivyAppProvider[\s>]/.test(readFileSync(p, 'utf8')));
check(
  'the provider is mounted in exactly one layout',
  mountFiles.length === 1,
  mountFiles.map((p) => path.relative(ROOT, p)).join(', ') || 'none found'
);
check(
  'and that layout is the route group above both routes',
  mountFiles.length === 1 && path.relative(ROOT, mountFiles[0]) === path.join('app', '(product)', 'layout.tsx'),
  mountFiles.length === 1 ? path.relative(ROOT, mountFiles[0]) : 'ambiguous'
);

// ---- 3. both routes live inside that group
const groupLayout = read(path.join('app', '(product)', 'layout.tsx'));
check('the group layout exists', groupLayout !== null);
check('the group layout imports the provider', (groupLayout ?? '').includes("from '@/components/providers/PrivyAppProvider'"));

const signIn = read(path.join('app', '(product)', 'signin', 'page.tsx'));
const appLayout = read(path.join('app', '(product)', 'app', 'layout.tsx'));
check('the sign-in page is inside the group', signIn !== null);
check('the app layout is inside the group', appLayout !== null);

// ---- 4. neither route mounts its own instance (this is the regression)
check(
  'the sign-in page does not mount its own provider',
  signIn !== null && !/<PrivyAppProvider[\s>]/.test(signIn),
  'a second instance here is the #249 outage'
);
check(
  'the app layout does not mount its own provider',
  appLayout !== null && !/<PrivyAppProvider[\s>]/.test(appLayout),
  'a second instance here is the #249 outage'
);

// ---- 5. no route exists outside the group under the old paths
for (const stale of [['signin', 'page.tsx'], ['app', 'layout.tsx']]) {
  const rel = path.join('app', ...stale);
  // The group is the only correct home: a file at app/signin/… or app/app/… would be
  // a SECOND route to the same URL and Next refuses to build two of them.
  check(`no duplicate route at ${rel.split(path.sep).join('/')}`, !existsSync(path.join(ROOT, rel)));
}

// ---- 6. the marketing page stays outside, so it ships no SDK
const landing = read(path.join('app', 'page.tsx'));
check('the landing page does not import the provider', landing !== null && !landing.includes('PrivyAppProvider'));

console.log('\n' + '-'.repeat(74));
if (failures.length) {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  process.exit(1);
}
console.log(`${passed} assertions passed.`);
