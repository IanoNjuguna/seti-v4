/**
 * `npm run check:filled` — one filled control per screen, and it is declared here (#491).
 *
 * `design/revolut.md` has stated the rule since #492: a screen gets ONE filled button, the action that moves
 * money or creates an obligation. A rule in a document and a `variant="primary"` in a file are two different
 * things, and nothing connected them.
 *
 * This does, by making the filled controls a DECLARED LIST. Adding one anywhere not in the table fails the
 * gate, which is the point: a second filled button on a screen is a hierarchy decision, and a decision
 * should be written down next to the reason for it rather than arrived at by autocomplete.
 *
 * Two assertions, and the second is the one that catches drift:
 *
 *   1. every filled usage in the tree belongs to a file in the table;
 *   2. no single file declares more than one, because two filled controls in one file is one screen with
 *      two commits by construction.
 *
 * Run from `web/`: npm run check:filled (part of the root `verify` gate).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/**
 * The filled controls, each with the screen it owns and why it is the commit.
 *
 * A landing BAND is a screen in this sense: a visitor scrolls one band at a time, and each band's CTA is the
 * only action visible when it is read. Four bands, four CTAs, one per band.
 */
const DECLARED = {
  'app/components/landing/HeroActions.tsx': 'landing hero: the only action above the fold',
  'app/components/landing/FeesSection.tsx': 'landing fee band: start the sign-up from the price',
  'app/components/landing/HowSection.tsx': 'landing how band: the CTA after the explanation',
  'app/components/landing/ClosingSection.tsx': 'landing closing band: the last action on the page',
  'components/home/SendSubmit.tsx': 'app send: the money leaves here',
  'components/ask/AskScreen.tsx': 'app claim: the figure is committed here',
  'components/ask/AskResult.tsx': 'app claim result: the one action after creating a claim',
  'components/receive/ReceiveHalf.tsx': 'app receive: sharing the name is the action',
  'components/receive/ReceiveNoName.tsx': 'app receive before a name exists: claiming one',
  'components/profile/ProfileSignedOut.tsx': 'signed-out profile: sign in, the only action',
  'components/receipt/ReceiptStates.tsx': 'receipt error state: retry, the only action',
  'components/mfa/MfaEnrolTotp.tsx': 'MFA enrolment: finishing enrolment',
};

const FILLED = /variant="(accent|primary)"/g;

/**
 * The FILESYSTEM, not `git ls-files`: a filled button in a file nobody has staged yet is exactly the moment
 * to catch it, and a check that only reads the index passes locally and fails in CI after the commit.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
  return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)));
}

const files = [...walk('app'), ...walk('components')];

const found = new Map();
for (const file of files) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const hits = source.match(FILLED);
  if (hits && hits.length > 0) found.set(file, hits.length);
}

console.log('every filled control is a declared one:');
{
  const undeclared = [...found.keys()].filter((file) => !DECLARED[file]);
  check(
    'nothing outside the table renders a filled button',
    undeclared.length === 0,
    undeclared.join(', ')
  );

  const missing = Object.keys(DECLARED).filter((file) => !found.has(file));
  check(
    'and every declared file still renders one',
    missing.length === 0,
    `${missing.join(', ')} is declared but renders no filled control`
  );
}

console.log('\nand it is one per screen:');
{
  const doubled = [...found.entries()].filter(([, count]) => count > 1);
  check('no file renders two', doubled.length === 0, doubled.map(([f, n]) => `${f}×${n}`).join(', '));

  const totals = [...found.values()].reduce((sum, n) => sum + n, 0);
  check('the tree holds exactly the declared controls', totals === Object.keys(DECLARED).length, String(totals));
}

console.log('\nthe weaker controls carry no fill of their own:');
{
  const constants = readFileSync(new URL('../components/ui/Button.constants.ts', import.meta.url), 'utf8');

  const block = (name) => {
    const at = constants.indexOf(`${name}:`);
    return constants.slice(at, constants.indexOf("'", constants.indexOf("'", at) + 1));
  };

  check(
    'ghost is a text link with no background',
    /bg-transparent/.test(block('ghost')) && !/bg-(surface|canvas|faint)/.test(block('ghost'))
  );
  check(
    'destructive is ink, not a slab',
    /text-accent-danger/.test(block('destructive')) && /bg-transparent/.test(block('destructive'))
  );
  check(
    'pill is a preset chip with a hairline',
    /border-hairline-light/.test(block('pill')) && /bg-transparent/.test(block('pill'))
  );
  check('and a chip can show its chosen state', /data-\[selected=true\]/.test(block('pill')));
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
