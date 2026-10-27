#!/usr/bin/env node
/**
 * `npm run check:privy-token-guard` — a reload must not revoke the Privy session.
 *
 * ## What broke without this (#252)
 *
 * `PrivyTokenBridge` handed the API client `() => getAccessToken()`, and
 * `lib/api/client.ts` calls that provider on EVERY request. `getAccessToken()` is
 * not a read: Privy's typing says that when it finds no valid token it will FORCE A
 * LOGOUT and return null. On a page reload the first boot-time request lands before
 * the SDK has restored its session, so it asked for a token, got null, and the SDK
 * revoked the refresh token server-side — `POST /api/v1/sessions/logout` 200 in the
 * same document that had just refreshed successfully. Seti's own session survived,
 * so the app looked signed in and could no longer sign anything. A claim made after
 * a reload failed with "your wallet session expired".
 *
 * The logout is invisible to every component test, because the call site is a
 * closure installed into a module-level singleton. So this reads the SOURCE and
 * asserts the three shapes that keep the session alive:
 *
 *   1. the bridge's provider is wrapped in the `authenticated` guard (and reads
 *      `authenticated` through a ref, so the closure cannot go stale);
 *   2. `readPrivyAccessToken`'s retry loop tests `isStillSignedIn()` BEFORE each
 *      `getAccessToken()` — a retry is itself a force-logout;
 *   3. nothing else in `web/` invokes `getAccessToken()` unguarded;
 *   4. the sign-in records terms acceptance with Privy, which is the ONE thing
 *      that stops the SDK revoking the session on every boot.
 *
 * ## Why (4) is the operative one
 *
 * The Privy app has `require_users_accept_terms: true`, and this app signs people
 * in headless — `loginWithCode` never opens Privy's terms screen — so
 * `user.hasAcceptedTerms` was false for every account. Privy's hydration path then
 * runs, on every document load:
 *
 *     o.legal.requireUsersAcceptTerms && i && !i.hasAcceptedTerms
 *       ? (await a.logout(), …)     // POST /api/v1/sessions/logout, session revoked
 *       : …
 *
 * Measured on a reload with the guard from (1) in place and every token read
 * blocked (7 provider calls, all `authenticated=false`, not one `getAccessToken()`):
 * `POST /sessions` 200 → six `GET /users/:id/wallets` 200 → `POST /sessions/logout`
 * 200, and the claim never issued. The logout does not need a token read at all.
 * Recording the acceptance the person already gave on Seti's own consent checkbox
 * makes `hasAcceptedTerms` true, and no restore has a reason to log out again.
 *
 * A small check on purpose: it asserts the shapes whose absence stranded every
 * new account mid-onboarding.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const BRIDGE = path.join('components', 'providers', 'PrivyTokenBridge.tsx');
const TOKEN_HELPER = path.join('lib', 'auth', 'privy-access-token.ts');

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

// ---- 1. the bridge only asks for a token behind `authenticated`
const bridge = read(BRIDGE);
check(`${BRIDGE.split(path.sep).join('/')} exists`, bridge !== null);

const bridgeSource = bridge ?? '';

check(
  'the bridge reads `authenticated` from the SDK',
  /usePrivy\(\)[\s\S]{0,80}authenticated/.test(bridgeSource) ||
    /\{\s*getAccessToken\s*,\s*authenticated\s*\}\s*=\s*usePrivy\(\)/.test(bridgeSource),
  'the provider cannot be guarded without it'
);

check(
  'the bridge holds `authenticated` in a ref, so the installed closure cannot go stale',
  /useRef\(\s*authenticated\s*\)/.test(bridgeSource),
  'a direct capture is false forever after the first render'
);

// The provider must be installed as a guarded thunk, not the bare read.
// Greedy-to-the-matching-`);` so both a one-line and a wrapped install are read.
const installed = bridgeSource.match(/setTokenProvider\(([\s\S]*?)\)\s*;/);
const installedBody = installed ? installed[1] : '';

check(
  'the bridge installs a provider at all',
  installed !== null
);

check(
  'the provider is wrapped in the `authenticated` guard',
  /authenticatedRef\.current\s*\?/.test(installedBody) && /:\s*null/.test(installedBody),
  installedBody
    ? `unguarded provider: ${installedBody.trim().split('\n')[0].trim()}`
    : 'no setTokenProvider call found'
);

check(
  'the guarded provider does not call `getAccessToken()` unconditionally',
  !/=>\s*getAccessToken\(\)/.test(bridgeSource),
  'that exact shape is the #252 force-logout'
);

// ---- 2. the retry loop guards EVERY attempt, not just the one after it
const helper = read(TOKEN_HELPER);
check(`${TOKEN_HELPER.split(path.sep).join('/')} exists`, helper !== null);

const helperSource = helper ?? '';
const loopStart = helperSource.indexOf('for (');
const loopToCall =
  loopStart === -1
    ? -1
    : helperSource.indexOf('getAccessToken()', loopStart) - loopStart;
const guardInLoop =
  loopStart === -1
    ? -1
    : helperSource.indexOf('isStillSignedIn()', loopStart) - loopStart;

check(
  'the token helper has a retry loop',
  loopStart !== -1
);

check(
  'the retry loop consults `isStillSignedIn()` BEFORE `getAccessToken()`',
  loopToCall > 0 && guardInLoop > 0 && guardInLoop < loopToCall,
  'a retry on an unauthenticated SDK is itself a force-logout'
);

// ---- 3. nothing else in web/ invokes getAccessToken() unguarded
//
// `privy-email-sign-in.ts` is the legitimate other consumer: it hands the function
// to `readPrivyAccessToken` by REFERENCE, which is guarded there. A bare invocation
// anywhere else has no guard above it and would revoke the session on its first
// unanswered read.
const allowed = new Set([
  path.join(ROOT, BRIDGE),
  path.join(ROOT, TOKEN_HELPER),
]);

const sources = walk(ROOT).filter((p) => !p.includes(`${path.sep}scripts${path.sep}`));
const offenders = [];
for (const file of sources) {
  if (allowed.has(file)) continue;
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, index) => {
    // An invocation, not a destructure, a type, or a reference passed along.
    if (/getAccessToken\s*\(/.test(line)) {
      offenders.push(
        `${path.relative(ROOT, file)}:${index + 1}  ${line.trim()}`
      );
    }
  });
}

check(
  'no file outside the bridge and the helper calls `getAccessToken()`',
  offenders.length === 0,
  offenders.join(' | ')
);

// ---- 4. the sign-in records the terms the person already accepted (#252)
//
// Without this, Privy's own hydration logs the account out on EVERY boot, because
// the app requires terms and a headless `loginWithCode` never sets
// `hasAcceptedTerms`. That is the revocation the rest of this file cannot prevent.
const SIGN_IN = path.join('lib', 'auth', 'privy-email-sign-in.ts');
const signIn = read(SIGN_IN);
check(`${SIGN_IN.split(path.sep).join('/')} exists`, signIn !== null);

const signInSource = signIn ?? '';

check(
  'the sign-in uses the SDK hook that records terms acceptance',
  /useAcceptTerms\(\)/.test(signInSource) && /\bacceptTerms\(\)/.test(signInSource),
  'without it every reload revokes the Privy session'
);

// Order matters: the acceptance must be recorded after login vouches for the user
// and before the session is treated as usable. A call placed before `loginWithCode`
// has no authenticated user to attach it to.
const loginAt = signInSource.indexOf('await loginWithCode(');
const acceptAt = signInSource.indexOf('await recordTermsAcceptance()');
check(
  'the acceptance is recorded AFTER the code is exchanged for a session',
  loginAt !== -1 && acceptAt !== -1 && acceptAt > loginAt,
  loginAt === -1 ? 'no loginWithCode call found' : 'acceptance is not recorded after login'
);

console.log('\n' + '-'.repeat(74));
if (failures.length) {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  process.exit(1);
}
console.log(`${passed} assertions passed.`);
