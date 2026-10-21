/**
 * `npm run check:activity-retry` — when a failed row may offer to pay again.
 *
 * The rule is one function and it is the whole reason the pill is honest: a row may
 * offer `Try again` only when the flow it opens can name the same recipient, which
 * means the row carries a resolved name. A screenshot can show the chip; it cannot
 * show that a pending payment, an incoming transfer, or a row written before payee
 * names existed all correctly offer NOTHING.
 */
import { retryHref } from '../components/activity/activity.retry.ts';

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

function row(overrides = {}) {
  return {
    id: 't1',
    merchant: 'Akinyi',
    category: 'Transfer',
    amount: -1250,
    direction: 'out',
    currency: 'KES',
    date: new Date('2026-10-21T09:00:00+03:00'),
    status: 'failed',
    payeeHandle: 'akinyi',
    ...overrides,
  };
}

console.log('the one row that may offer it:');
{
  const href = retryHref(row());

  check('a failed transfer to a named person offers a destination', typeof href === 'string');
  check('the destination is the send flow, not a receipt', href?.startsWith('/app/send?') === true);
  check('it names the payee the row was resolved from', href?.includes('to=akinyi') === true);
  check('it carries the row figure, as a positive amount', href?.includes('amount=1250.00') === true);
}

console.log('names that are not plain words:');
{
  check('a handle with a dot survives the query', retryHref(row({ payeeHandle: 'co.op' }))?.includes('to=co.op') === true);
  check(
    'a name that needs escaping is escaped, not concatenated',
    retryHref(row({ payeeHandle: 'a b' }))?.includes('to=a+b') === true,
    String(retryHref(row({ payeeHandle: 'a b' })))
  );
}

console.log('rows that must offer nothing:');
{
  check('a completed payment', retryHref(row({ status: 'completed' })) === null);
  check('a pending payment — it may still settle, so it must not be sent twice', retryHref(row({ status: 'pending' })) === null);
  check('money coming in is not a send', retryHref(row({ amount: 2500, direction: 'in' })) === null);
  check('a failed row with no payee name (an address cannot be resolved back)', retryHref(row({ payeeHandle: null })) === null);
  check('a payee name of whitespace', retryHref(row({ payeeHandle: '   ' })) === null);
  check('a row whose figure is zero', retryHref(row({ amount: 0 })) === null);
  check('a row written before payee names existed', retryHref(row({ payeeHandle: undefined })) === null);
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
