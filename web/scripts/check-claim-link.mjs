/**
 * `npm run check:claim-link` — a claim link pays only an open claim, and never carries a figure (#447).
 *
 * Two pure functions decide the whole page, so they are asserted directly rather than through a
 * browser: `claimRoute` (what `/app/pay?ask=` does next) and `sendSeed` (what `/app/send` will accept
 * from a query string).
 *
 * What this pins, and why each one could rot silently:
 *
 *  1. **Only `open` reaches the send flow.** A paid, withdrawn or lapsed claim that mounted a payment
 *     form would produce a send the settle must refuse, and the payer would only learn at the end.
 *  2. **The four answers are distinct sentences.** "Already paid" and "was withdrawn" are different
 *     facts about somebody's money; one shared message would be cheaper and worse.
 *  3. **The forward carries `to` and `claim`, and nothing else.** No amount: a claim's figure lives in
 *     the row the server reads, which is what keeps `?amount=` unable to prefill a payment (#99).
 *  4. **The seed whitelist still drops `amount`**, and drops a `claim` that is not id-shaped.
 *
 * Run from `web/`: npm run check:claim-link (part of the root `verify` gate).
 */
import { claimRoute, CLAIM_NOT_FOUND } from '../components/ask/claimRoute.ts';
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

const open = {
  publicId: 'a1b2c3d4e5f60718',
  destinationHandle: 'ian',
  amount: '500.00',
  currency: 'KES',
  status: 'open',
};

console.log('an open claim goes to the send flow, naming the claim and the payee:');
{
  const route = claimRoute(open);

  check('it forwards', route.kind === 'forward', route.kind);
  const href = route.kind === 'forward' ? route.href : '';
  check('to the send flow', href.startsWith('/app/send?'), href);

  const query = new URLSearchParams(href.split('?')[1] ?? '');
  check('naming the payee', query.get('to') === 'ian', String(query.get('to')));
  check('naming the claim', query.get('claim') === open.publicId, String(query.get('claim')));
  check(
    'and no amount, because the figure lives in the row',
    !query.has('amount') && !href.includes('500'),
    href
  );
  check('exactly those two parameters', [...query.keys()].sort().join(',') === 'claim,to', [...query.keys()].join(','));
}

console.log('\nevery unpayable state is a sentence, not a payment form:');
{
  for (const status of ['settled', 'cancelled', 'expired']) {
    const route = claimRoute({ ...open, status });
    check(`${status} does not forward`, route.kind === 'answer', route.kind);
    check(`${status} says something`, route.kind === 'answer' && route.body.length > 20);
  }

  const settled = claimRoute({ ...open, status: 'settled' });
  const cancelled = claimRoute({ ...open, status: 'cancelled' });
  const expired = claimRoute({ ...open, status: 'expired' });
  const titles = [settled, cancelled, expired].map((r) => (r.kind === 'answer' ? r.title : ''));
  check('and the three titles differ', new Set(titles).size === 3, titles.join(' | '));
  check('paid is about the money', /paid/i.test(titles[0]), titles[0]);
  check('withdrawn is about the writer', /withdrawn/i.test(titles[1]), titles[1]);
  check('lapsed is about the window', /lapsed/i.test(titles[2]), titles[2]);
  check('no answer offers a retry.', [settled, cancelled, expired].every((r) => r.kind === 'answer' && !/try again|retry/i.test(r.body)));
}

console.log('\nan unknown link is one answer, not a probe:');
{
  const route = claimRoute(null);
  check('an unreadable claim is an answer', route.kind === 'answer', route.kind);
  check(
    'and says the link does not work',
    route.kind === 'answer' && route.title === CLAIM_NOT_FOUND.title,
    route.kind === 'answer' ? route.title : ''
  );
  check(
    'without claiming the id exists or not',
    route.kind === 'answer' && !/exists|unknown|no such/i.test(route.body),
    route.kind === 'answer' ? route.body : ''
  );
}

console.log('\nwhat a URL may seed: a claim id, never a figure:');
{
  const seed = sendSeed(new URLSearchParams('to=ian&claim=a1b2c3d4e5f60718&amount=500'));
  check('the payee survives', seed.linked === 'ian', String(seed.linked));
  check('the claim survives', seed.claim === 'a1b2c3d4e5f60718', String(seed.claim));
  check('the amount does not', !('amount' in seed), Object.keys(seed).join(','));

  const bad = sendSeed(new URLSearchParams('to=ian&claim=../../etc/passwd'));
  check('a claim that is not id-shaped is dropped', bad.claim === null, String(bad.claim));

  const empty = sendSeed(new URLSearchParams('to=&handle='));
  check('a link that names nobody names nobody', empty.linked === null, String(empty.linked));

  const legacy = sendSeed(new URLSearchParams('handle=merchant'));
  check('the old pay link still resolves', legacy.linked === 'merchant', String(legacy.linked));
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
