/**
 * `npm run check:analytics` — the activity summary.
 *
 * The whole point of this module is that its figures are reconcilable, so the
 * assertions are about arithmetic and about exclusion, not about shape:
 *
 *  - in minus out equals net, on every fixture, computed from the same pass;
 *  - anything not `completed` is absent from every figure;
 *  - a window boundary counts a row once, in the right window;
 *  - a malformed amount is reported as skipped, never silently dropped;
 *  - merchants are payments only, biggest first, capped.
 *
 * No database: `summariseWindow` takes rows, so the behaviour is provable without one.
 */
import type { AnalyticsRow } from './analytics.js';
import { convertWindow, directionOf, summariseWindow } from './analytics.js';

let passed = 0;
let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`ok    ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? `  ${detail}` : ''}`);
  }
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-20T12:00:00Z');

function row(
  type: AnalyticsRow['type'],
  amount: string,
  daysAgo: number,
  extra: Partial<AnalyticsRow> = {}
): AnalyticsRow {
  return {
    type,
    status: 'completed',
    amount,
    createdAt: new Date(NOW.getTime() - daysAgo * DAY),
    merchantName: null,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// direction: which types move money, and which do not
// ---------------------------------------------------------------------------

console.log('direction of each ledger type:');
check('a receive is money in', directionOf('p2p_receive') === 'in');
check('a top-up is money in', directionOf('top_up') === 'in');
check('a payment is money out', directionOf('payment') === 'out');
check('a send is money out', directionOf('p2p_send') === 'out');
check('a withdrawal is money out', directionOf('withdrawal') === 'out');
check('a fee is money out', directionOf('fee') === 'out');

// ---------------------------------------------------------------------------
// the arithmetic
// ---------------------------------------------------------------------------

console.log('in, out, net:');
{
  const rows = [
    row('p2p_receive', '100.00', 1),
    row('top_up', '50.00', 2),
    row('payment', '30.00', 3, { merchantName: 'Java House' }),
    row('p2p_send', '20.00', 4),
  ];
  const week = summariseWindow(rows, 7, NOW);

  check('two inflows add up', week.in === 150, String(week.in));
  check('two outflows add up', week.out === 50, String(week.out));
  check('net is in minus out', week.net === 100, String(week.net));
  check('every settled row is counted once', week.count === 4, String(week.count));
  check('nothing was skipped', week.skipped === 0, String(week.skipped));
}

// ---------------------------------------------------------------------------
// what does NOT count
// ---------------------------------------------------------------------------

console.log('exclusions:');
{
  const rows = [
    row('payment', '10.00', 1, { status: 'pending' }),
    row('payment', '10.00', 1, { status: 'processing' }),
    row('payment', '10.00', 1, { status: 'failed' }),
    row('payment', '10.00', 1, { status: 'reversed' }),
    row('payment', '10.00', 1, { status: 'completed' }),
  ];
  const week = summariseWindow(rows, 7, NOW);

  check('a pending movement is not money', week.out === 10, String(week.out));
  check('only the settled row is counted', week.count === 1, String(week.count));
}

// ---------------------------------------------------------------------------
// window boundaries
// ---------------------------------------------------------------------------

console.log('window boundaries:');
{
  const rows = [row('payment', '5.00', 3), row('payment', '7.00', 10), row('payment', '9.00', 40)];
  const week = summariseWindow(rows, 7, NOW);
  const month = summariseWindow(rows, 30, NOW);

  check('the week sees only the last seven days', week.out === 5, String(week.out));
  check('the month sees the last thirty', month.out === 12, String(month.out));
  check('a row older than thirty days is in neither', week.count === 1 && month.count === 2);
}

// ---------------------------------------------------------------------------
// merchants
// ---------------------------------------------------------------------------

console.log('merchants:');
{
  const rows = [
    row('payment', '10.00', 1, { merchantName: 'Java House' }),
    row('payment', '40.00', 2, { merchantName: 'Naivas' }),
    row('payment', '15.00', 3, { merchantName: 'Java House' }),
    row('payment', '5.00', 4, { merchantName: 'Bolt' }),
    row('payment', '3.00', 5, { merchantName: 'Uber' }),
    row('p2p_send', '99.00', 6, { merchantName: 'Java House' }),
  ];
  const week = summariseWindow(rows, 7, NOW);

  check('biggest spender first', week.merchants[0]?.name === 'Naivas', String(week.merchants[0]?.name));
  check('repeat payments aggregate', week.merchants[1]?.total === 25, String(week.merchants[1]?.total));
  check('and count as two visits', week.merchants[1]?.count === 2, String(week.merchants[1]?.count));
  check('capped at three merchants', week.merchants.length === 3, String(week.merchants.length));
  check(
    'a send to a person is not a merchant spend',
    !week.merchants.some((merchant) => merchant.total === 99)
  );
}

// ---------------------------------------------------------------------------
// bad data is visible, not silent
// ---------------------------------------------------------------------------

console.log('malformed rows:');
{
  const rows = [row('payment', '10.00', 1), row('payment', 'not-a-number', 1), row('payment', '-5.00', 1)];
  const week = summariseWindow(rows, 7, NOW);

  check('a malformed amount does not enter the sum', week.out === 10, String(week.out));
  check('it is reported as skipped', week.skipped === 2, String(week.skipped));
  check('and it does not produce NaN', Number.isFinite(week.net));
}

// ---------------------------------------------------------------------------
// nothing at all
// ---------------------------------------------------------------------------

console.log('an empty account:');
{
  const week = summariseWindow([], 7, NOW);
  check('zeros, not an error', week.in === 0 && week.out === 0 && week.net === 0);
  check('no merchants', week.merchants.length === 0);
  check('and no invented count', week.count === 0);
}

console.log('the three figures reconcile:');
{
  // An awkward rate on purpose: 129.5 makes each conversion end in a half-cent.
  const rate = 129.5;
  const figures = convertWindow({ in: 269270216.43, out: 227095.36 }, rate);
  const cents = (value: string) => Math.round(Number(value) * 100);

  check(
    'in minus out equals net, to the cent',
    cents(figures.in) - cents(figures.out) === cents(figures.net),
    `${figures.in} - ${figures.out} vs ${figures.net}`
  );

  const loss = convertWindow({ in: 10, out: 25.5 }, rate);
  check('a loss-making window has a negative net', Number(loss.net) < 0, loss.net);
  check(
    'and still reconciles',
    cents(loss.in) - cents(loss.out) === cents(loss.net),
    `${loss.in} - ${loss.out} vs ${loss.net}`
  );

  const empty = convertWindow({ in: 0, out: 0 }, rate);
  check('an empty window is three zeros', empty.in === '0.00' && empty.out === '0.00' && empty.net === '0.00');
}

console.log('-'.repeat(74));
console.log(failures === 0 ? `All ${passed} checks passed.` : `${failures} of ${passed + failures} checks FAILED.`);
if (failures > 0) process.exit(1);
