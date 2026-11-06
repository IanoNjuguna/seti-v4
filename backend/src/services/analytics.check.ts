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
import {
  convertWindow,
  dayKey,
  directionOf,
  fillRange,
  halfFigures,
  medianOf,
  MONEY_TYPES,
  summariseWindow,
} from './analytics.js';

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

/*
 * The daily series (#369). The streak map draws one square per day, so what matters is that
 * the series is a CALENDAR: n entries, oldest first, one per day, with the quiet days present
 * as zeros rather than missing.
 */
{
  const now = new Date('2026-11-06T12:00:00Z');
  const at = (daysAgo: number, hours = 9) =>
    new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);
  const row = (type: AnalyticsRow['type'], daysAgo: number, amount = 10): AnalyticsRow => ({
    type,
    status: 'completed',
    amount: String(amount),
    createdAt: at(daysAgo),
    merchantName: 'Shop',
  });

  const totals = summariseWindow(
    [row('payment', 0), row('payment', 0), row('p2p_receive', 2), row('payment', 29)],
    30,
    now
  );

  check('a 30-day window returns exactly 30 days', totals.daily.length === 30, String(totals.daily.length));
  check(
    'the series is oldest first and ends on the day it was measured',
    totals.daily[0].date === dayKey(at(29)) && totals.daily[29].date === dayKey(at(0)),
    `${totals.daily[0].date} … ${totals.daily[29].date}`
  );
  check(
    'a quiet day is a zero, not a missing row',
    totals.daily.every((day) => typeof day.count === 'number') &&
      totals.daily.reduce((sum, day) => sum + day.count, 0) === 4,
    String(totals.daily.reduce((sum, day) => sum + day.count, 0))
  );
  check(
    'two payments on one day count as two, not one',
    totals.daily[29].count === 2,
    String(totals.daily[29].count)
  );
  check(
    'a pending row is absent from the series as well as the totals',
    summariseWindow([{ ...row('payment', 0), status: 'pending' }], 30, now).daily.every((d) => d.count === 0)
  );
}

console.log('the map is the year the account is living:');
{
  // A range is inclusive at both ends, so a year from 6 Nov runs to 5 Nov a year later.
  const from = new Date(Date.UTC(2026, 10, 6));
  const to = new Date(Date.UTC(2027, 10, 5));
  const range = fillRange(new Map([['2026-11-06', 3]]), from, to);

  check('a year of days is 365 entries', range.length === 365, `${range.length}`);
  check('the first entry is the day the account joined', range[0]?.date === '2026-11-06', range[0]?.date);
  check('the last entry is the day before its anniversary', range.at(-1)?.date === '2027-11-05', range.at(-1)?.date);
  check('a day with money keeps its count', range[0]?.count === 3, `${range[0]?.count}`);
  check('and a day without, including the days ahead, is a zero', range.at(-1)?.count === 0);
  check('the entries are in date order, oldest first', range.every((day, index) => index === 0 || day.date > (range[index - 1]?.date ?? '')));

  check('the map counts a payment', MONEY_TYPES.includes('payment'));
  check('and a fee', MONEY_TYPES.includes('fee'));
  check('but not a swap between the customer\'s own assets', !MONEY_TYPES.includes('convert'));
  check('and not money moving into the vault', !MONEY_TYPES.includes('savings_deposit'));
  check('or out of it', !MONEY_TYPES.includes('savings_withdrawal'));
}

console.log('the two halves, and the person on the other side:');
{
  const row = (type: 'payment' | 'p2p_receive' | 'top_up', amount: string, daysAgo: number, fee = '0') => ({
    type,
    status: 'completed' as const,
    amount,
    createdAt: new Date(Date.UTC(2026, 10, 6 - daysAgo)),
    merchantName: type === 'payment' ? 'Java House' : null,
    counterparty: '0xabc',
    fee,
  });

  const rows = [
    row('payment', '100', 0, '2'),
    row('payment', '300', 1, '6'),
    row('payment', '200', 2, '4'),
    row('p2p_receive', '50', 0),
    row('p2p_receive', '70', 3),
    row('top_up', '999', 1),
  ];
  const totals = summariseWindow(rows, 7, new Date(Date.UTC(2026, 10, 6)));

  check('a payment is money out and a half of its own', totals.paidOut.count === 3 && totals.paidOut.total === 600, String(totals.paidOut.total));
  check('the fee it carried is summed beside it', totals.paidOut.fees === 12, String(totals.paidOut.fees));
  check('a receive is money in and the other half', totals.received.count === 2 && totals.received.total === 120, String(totals.received.total));
  check('a bridge top-up is neither: money in, but not income', totals.paidOut.count + totals.received.count === 5);
  check('the median is the middle value, not the mean', medianOf([100, 300, 200]) === 200, String(medianOf([100, 300, 200])));
  check('an even set takes the mean of the two middles', medianOf([100, 200, 300, 400]) === 250, String(medianOf([100, 200, 300, 400])));
  check('no rows is a zero, not a NaN', medianOf([]) === 0);

  const half = halfFigures(totals.paidOut, 129);
  check(
    'the average is the total over the count, in the same money as the total',
    half.average === convertWindow({ in: totals.paidOut.total / 3, out: 0 }, 129).in,
    half.average
  );
  check('and both ticket sizes print money with two decimals', /[\d,]+\.\d{2}$/.test(half.average) && /[\d,]+\.\d{2}$/.test(half.median), `${half.average} / ${half.median}`);
}

console.log('-'.repeat(74));
console.log(failures === 0 ? `All ${passed} checks passed.` : `${failures} of ${passed + failures} checks FAILED.`);
if (failures > 0) process.exit(1);
