#!/usr/bin/env node
/**
 * `npm run check:signin-sessions` — a sign-in is a login, never a link (#515).
 *
 * ## What broke without this
 *
 * Privy's session outlives Seti's. Seti's ends when `/auth/me` refuses the token on a
 * restore, when a tab is left open past the hour, or when someone clears storage — none
 * of which ends Privy's. The next `passwordless/authenticate` then rides the session the
 * browser is still holding, so Privy reads the attempt as *linking this email onto the
 * user I am already signed in as* and refuses it:
 *
 *     POST https://auth.privy.io/api/v1/passwordless/authenticate   400
 *     {"error":"User already has one email account linked","code":"cannot_link_more_of_type"}
 *
 * Reproduced on production against a temp inbox: a fresh, correct code for B was refused
 * in a browser still signed in as A, and the same code signed in the moment the browser
 * held no session. It failed in one browser and worked in another, with the same email,
 * which is exactly how it was reported.
 *
 * The app made it look like a mistyped digit because every refusal at the code step
 * printed one sentence, and left no artefact anywhere. So this check reads the SOURCE and
 * asserts the four shapes whose absence produced that:
 *
 *   1. the Privy half exposes an `endSession`, and it is Privy's own `logout()`;
 *   2. `signIn` calls it BEFORE `sendCode`, so no code is ever mailed into a link attempt;
 *   3. the vendor codes that mean "another account is signed in here" and "this code is
 *      spent" map to their OWN sentences, not to the mistyped-digit one;
 *   4. a refusal is logged once with the vendor's identifier, on both steps.
 *
 * A small check on purpose, in the style of `check:privy-mount` and
 * `check:privy-token-guard`: every assertion here is a shape whose absence stranded
 * someone at the code field with a code that was never wrong.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const AUTH_CONSTANTS = path.join('lib', 'auth', 'auth.constants.ts');
const PRIVY_EMAIL = path.join('lib', 'auth', 'privy-email-sign-in.ts');
const SESSION_PROVIDER = path.join('lib', 'auth', 'SessionProvider.tsx');

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

const privyEmail = read(PRIVY_EMAIL);
const provider = read(SESSION_PROVIDER);
const constants = read(AUTH_CONSTANTS);

check('the Privy email sign-in module exists', privyEmail !== null, PRIVY_EMAIL);
check('the session provider exists', provider !== null, SESSION_PROVIDER);
check('the auth constants module exists', constants !== null, AUTH_CONSTANTS);

// ---- 1. the Privy half can end the session this browser still holds
check(
  'PrivyEmailSignIn declares endSession',
  privyEmail !== null && /endSession:\s*\(\)\s*=>\s*Promise<void>/.test(privyEmail)
);
check(
  'endSession is Privy\'s own logout, not a local clear',
  privyEmail !== null && /await logout\(\)/.test(privyEmail)
);
check(
  'the no-Privy stand-in answers endSession too',
  privyEmail !== null && /endSession:\s*noSession/.test(privyEmail)
);
check(
  'endSession is handed out by the hook',
  privyEmail !== null && /\(\) => \(\{\s*endSession,/.test(privyEmail)
);

// ---- 2. signIn ends it BEFORE the code is mailed
const endIdx = provider === null ? -1 : provider.indexOf('privyEmail.endSession()');
const sendIdx = provider === null ? -1 : provider.indexOf('privyEmail.sendCode(');
check(
  'signIn ends the browser\'s Privy session',
  endIdx !== -1,
  'no call to privyEmail.endSession() in the session provider'
);
check(
  'and does it before it mails a code',
  endIdx !== -1 && sendIdx !== -1 && endIdx < sendIdx,
  `endSession at ${endIdx}, sendCode at ${sendIdx}`
);

// ---- 3. the causes are told apart
check(
  'a stale session on this browser is matched by its vendor code',
  constants !== null && constants.includes("'cannot_link_more_of_type'")
);
check(
  'a linked-email conflict is matched too',
  constants !== null && constants.includes("'linked_to_another_user'")
);
check(
  'a spent code is matched by its vendor code',
  constants !== null && constants.includes("'invalid_credentials'")
);
check(
  'a throttle is matched',
  constants !== null && /status === 429|'too_many_requests'/.test(constants)
);

/**
 * The four sentences must be DISTINCT. Sharing one is the whole bug: the mistyped-digit
 * sentence was also the stale-session sentence and the spent-code sentence, so a person
 * was told to re-read digits that were correct.
 */
const sentences = {
  refused: /const CODE_REFUSED =\s*'([^']+)'/.exec(constants ?? '')?.[1],
  spent: /const CODE_SPENT =\s*\n?\s*'([^']+)'/.exec(constants ?? '')?.[1],
  otherAccount: /const OTHER_ACCOUNT_SIGNED_IN =\s*\n?\s*'([^']+)'/.exec(constants ?? '')?.[1],
  tooMany: /const TOO_MANY_ATTEMPTS =\s*\n?\s*'([^']+)'/.exec(constants ?? '')?.[1],
};
const declared = Object.entries(sentences).filter(([, text]) => typeof text === 'string');
check('all four refusal sentences are declared', declared.length === 4, declared.map(([k]) => k).join(', '));
check(
  'and no two of them are the same sentence',
  new Set(declared.map(([, text]) => text)).size === declared.length
);

// ---- 4. a refusal leaves a record
check(
  'logPrivySignInFailure is exported',
  constants !== null && /export function logPrivySignInFailure\(/.test(constants)
);
check(
  'and it carries the vendor code and status',
  constants !== null && /console\.error\(/.test(constants) && /\{\s*code,\s*status,\s*message\s*\}/.test(constants)
);
const loggedCode = (provider?.match(/logPrivySignInFailure\('code'/g) ?? []).length;
const loggedSession = (provider?.match(/logPrivySignInFailure\('session'/g) ?? []).length;
check('the code step logs its refusal', loggedCode >= 1);
check('the session step logs its refusal', loggedSession >= 1);

console.log('\n' + '-'.repeat(74));
if (failures.length) {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  process.exit(1);
}
console.log(`${passed} assertions passed.`);
