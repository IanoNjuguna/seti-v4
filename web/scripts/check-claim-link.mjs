/**
 * `npm run check:claim-link` — a claim link pays only an open claim (#447).
 *
 * Two seams, both of which fail silently without this:
 *
 *  1. **The sentences.** `claimAnswer` is pure, so the four outcomes are asserted directly: the three
 *     closed states each get their own title, none offers a retry, and an unknown id is a fifth thing.
 *  2. **The forwarding.** `/app/pay?ask=<id>` must hand the id to `/app/send?claim=<id>`, and the
 *     amount must never travel in a URL. That is checked against the route's source, because the
 *     forwarding is a client redirect and the assertion that matters is which parameter it reads.
 *
 * Run from `web/`: npm run check:claim-link (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { claimAnswer, CLAIM_UNKNOWN } from '../components/ask/claim-lines.ts';
import { sendSeed } from '../components/send/sendSeed.ts';

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

console.log('an open claim mounts the payment; nothing else is answered:');
{
  check('no claim at all is not an answer', claimAnswer(null) === null);
  check('an open claim is not an answer', claimAnswer('open') === null);
  check('a settled claim is', claimAnswer('settled') !== null);
  check('so is a cancelled one', claimAnswer('cancelled') !== null);
  check('so is a lapsed one', claimAnswer('expired') !== null);
}

console.log('\nevery closed state says what happened to the money:');
{
  const settled = claimAnswer('settled');
  const cancelled = claimAnswer('cancelled');
  const expired = claimAnswer('expired');

  const titles = [settled.title, cancelled.title, expired.title];
  check('the three titles differ', new Set(titles).size === 3, titles.join(' | '));
  check('paid is about the money', /^This has been paid$/i.test(settled.title), settled.title);
  check('withdrawn is about the writer', /withdrawn/i.test(cancelled.title), cancelled.title);
  check('lapsed is about the window', /lapsed/i.test(expired.title), expired.title);
  check(
    'no answer offers a retry, because a retry pays twice',
    [settled, cancelled, expired].every((a) => !/try again|retry/i.test(a.body))
  );
  check(
    'and every one says something',
    [settled, cancelled, expired].every((a) => a.body.length > 30)
  );
}

console.log('\nan id that resolves to nothing is its own answer:');
{
  const unknown = claimAnswer('unknown');
  check('it has one', unknown !== null);
  check('and it is the shared sentence', unknown.title === CLAIM_UNKNOWN.title, unknown.title);
  check(
    'and it does not pretend to know whether the claim exists',
    !/exists|no such|unknown id/i.test(unknown.body),
    unknown.body
  );
}

console.log('\nthe claim link forwards the id, never a figure:');
{
  const payPage = readFileSync(new URL('../app/(product)/app/pay/page.tsx', import.meta.url), 'utf8');
  check('the pay page reads ?ask', /params\.get\('ask'\)/.test(payPage));
  check('and forwards it as ?claim', /\/app\/send\?claim=/.test(payPage));
  check('and no amount is put in the URL', !/send\?[^`'"]*amount=/.test(payPage));

  const seed = sendSeed(new URLSearchParams('claim=a1b2c3d4e5f60718&amount=500'));
  check('the send flow accepts the claim id', seed.claim === 'a1b2c3d4e5f60718', String(seed.claim));
  check('and drops the amount from a link', !('amount' in seed), Object.keys(seed).join(','));
}

console.log('\nthe figure a claim states cannot be typed over:');
{
  const panel = readFileSync(new URL('../components/home/useSendPanel.ts', import.meta.url), 'utf8');
  const section = readFileSync(new URL('../components/home/SendAmountSection.tsx', import.meta.url), 'utf8');

  check(
    'the amount setter refuses while a claim is set',
    /if \(claim\) return;/.test(panel),
    'no claim guard in setAmountKes'
  );
  check('and the lock is reported to the form', /amountLocked: claim != null/.test(panel));
  check(
    'the field is disabled, not merely validated later',
    /disabled=\{busy \|\| amountLocked === true\}/.test(section),
    'amount field is not disabled when locked'
  );
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
