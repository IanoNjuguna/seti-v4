/**
 * `npm run check:claim-states` — what step three of onboarding says when a claim
 * fails, and whether the four ways it can fail are four different sentences.
 *
 * The bug this exists for: a new account was told "That name could not be claimed"
 * when the failure was that nothing could sign, and "Nothing was claimed. Try
 * again." for every other pre-server failure. The name was fine. The backend had
 * already called it free. The person retried the same tap three times and the app
 * recorded nothing anywhere.
 *
 * So this renders the REAL component tree, through `OnboardingIntent`, and reads
 * the markup a browser receives. Five things are pinned:
 *
 *  1. **Four failures, four sentences.** A missing wallet, a wallet that would not
 *     sign, a taken name and a server refusal each produce their own body, and no
 *     two of them are the same string. A single generic line is the defect.
 *  2. **The heading does not blame the name.** "That name could not be claimed" is
 *     gone from the source entirely, because it is false for three of the four.
 *  3. **The action matches the fix.** `wallet-missing` renders "Sign in again",
 *     because a retry cannot produce a wallet. Nothing else does.
 *  4. **The classification is the behaviour.** Markers are matched in order, Privy's
 *     JSON-RPC 4900 is definitive on its own, and anything unrecognised is the
 *     wallet refusing rather than a mystery.
 *  5. **The form keeps its split.** A name problem still belongs on the field, so the
 *     intent step must not print it as a block message about the claim.
 *
 * Run from `web/`: npm run check:claim-states (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnboardingIntent } from '../components/onboarding/OnboardingIntent.tsx';
import { claimErrorView } from '../components/merchant/Claim.error.ts';
import { classifyClaimError } from '../lib/claim/classify-claim-error.ts';
import { REFUSAL_BY_CODE, REFUSAL_UNKNOWN, refusalMessageFor } from '../lib/api/refusal.constants.ts';

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

/** The name step's own heading, which is the honest one for a failed claim. */
const ERROR_TITLE = 'Name not claimed';

/** The callbacks the step needs; the check is about words, not behaviour. */
const NOOP = () => {};

function render(claim) {
  return renderToStaticMarkup(
    createElement(OnboardingIntent, {
      pending: null,
      busy: false,
      claim,
      onChoose: NOOP,
      onSignIn: NOOP,
    })
  );
}

/** A failure the way the app builds one: throw, classify, take the sentence. */
function failureFrom(error) {
  const code = classifyClaimError(error);
  return { error: refusalMessageFor(code), errorCode: code, errorRequestId: null };
}

// The errors, as they are actually thrown on the way to a claim.
const noWallet = Object.assign(new Error('No embedded wallet is available for this account yet.'), {
  name: 'NoEmbeddedWalletError',
});
const disconnected = Object.assign(new Error('Disconnected'), { code: 4900 });
const cannotConnect = new Error('Unable to connect to wallet');
const rejected = new Error('User rejected the request');
const mystery = new TypeError("Cannot read properties of undefined (reading 'chainId')");

// --- 1. the classification, marker by marker ------------------------------
check('the classifier is the only place a wallet failure is named', (() => {
  const source = readSource('../lib/claim/classify-claim-error.ts');
  return source.includes('MISSING_WALLET_MARKERS') && !source.includes('refusalMessageFor');
})());

check('our own no-wallet error is wallet-missing', classifyClaimError(noWallet) === 'wallet-missing');
check('Privy 4900 Disconnected is wallet-missing', classifyClaimError(disconnected) === 'wallet-missing');
check('"Unable to connect to wallet" is wallet-missing', classifyClaimError(cannotConnect) === 'wallet-missing');
check('a dismissed prompt is wallet-signing-failed', classifyClaimError(rejected) === 'wallet-signing-failed');
check('an unrecognised throw is wallet-signing-failed', classifyClaimError(mystery) === 'wallet-signing-failed');
check('every classified code has a sentence of its own', ['wallet-missing', 'wallet-signing-failed'].every((code) => {
  const sentence = REFUSAL_BY_CODE[code];
  return typeof sentence === 'string' && sentence.length > 20 && sentence !== REFUSAL_UNKNOWN;
}));

// --- 2. four failures, four sentences -------------------------------------
const missing = failureFrom(noWallet);
const refused = failureFrom(rejected);
const taken = { error: refusalMessageFor('handle-taken'), errorCode: 'handle-taken', errorRequestId: 'req_8f2c1a4e' };
const offline = { error: refusalMessageFor(undefined), errorCode: null, errorRequestId: null };

const html = {
  missing: render(missing),
  refused: render(refused),
  taken: render(taken),
  offline: render(offline),
};

for (const [name, body] of Object.entries({
  missing: missing.error,
  refused: refused.error,
  taken: taken.error,
  offline: offline.error,
})) {
  check(`${name}: the sentence is rendered on the page`, html[name].includes(escapeHtml(body)), body);
}

const bodies = [missing.error, refused.error, taken.error, offline.error];
check('no two of the four states say the same thing', new Set(bodies).size === 4, `${new Set(bodies).size} distinct`);

// --- 3. the heading and the action ---------------------------------------
check('the heading names the claim, not the name', Object.values(html).every((markup) => markup.includes(ERROR_TITLE)));
check(
  'the old sentence that blamed the name is neither copied nor rendered',
  Object.values(html).every((markup) => !markup.includes('could not be claimed')) &&
    !readSource('../components/onboarding/Onboarding.constants.ts').includes('could not be claimed')
);

check('wallet-missing offers a sign-in', html.missing.includes('Sign in again'));
check('a refusal the wallet made does NOT offer a sign-in', !html.refused.includes('Sign in again'));
check('a taken name does NOT offer a sign-in', !html.taken.includes('Sign in again'));
check('a server refusal prints its reference', html.taken.includes('req_8f2c1a4e'));
check('a pre-server failure prints no reference', !html.missing.includes('Reference'));

// --- 4. the two options are still the step's own -------------------------
check(
  'both intents are still on the page',
  Object.values(html).every(
    (markup) => markup.includes('Claim a username') && markup.includes('Claim a business name')
  )
);

// --- 5. a name problem stays on the field --------------------------------
for (const code of ['invalid-handle-name', 'reserved-handle']) {
  const view = claimErrorView({ error: refusalMessageFor(code), errorCode: code, errorRequestId: null });
  check(`${code} is a field problem, not a block refusal`, view.nameProblem === true && view.blockError === null);
}

// --- 6. the voice -------------------------------------------------------
const sentences = [...bodies, ERROR_TITLE, REFUSAL_BY_CODE['wallet-missing'], REFUSAL_BY_CODE['wallet-signing-failed']];
check('no em dash, no exclamation, no question mark', sentences.every((s) => !/[—!?]/.test(s)));
check(
  'every wallet sentence says nothing was claimed',
  ['wallet-missing', 'wallet-signing-failed'].every((code) => /nothing was claimed/i.test(REFUSAL_BY_CODE[code]))
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readSource(relative) {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}
