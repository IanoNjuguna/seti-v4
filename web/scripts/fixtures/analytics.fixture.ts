/**
 * Fixed figures for `check:analytics-page`.
 *
 * One window, hand-built so the arithmetic in the assertions is checkable by eye: `in` 5,000 minus
 * `out` 3,750 is the net, 1,250, `out` carries a 75.00 fee, and the 30 days behind it are quiet on
 * most of them. Nothing here is a claim about a real account; it is a shape to render.
 *
 * `payerOnly` is the second shape and the one the suite exists for (#534): the account in the
 * reported screen, which paid three merchants and received nothing. Its net is negative on purpose
 * — that is the figure the page must stop leading with.
 */
import type {
  AnalyticsDetailBandProps,
  AnalyticsSeriesBandProps,
  AnalyticsSummaryBandProps,
} from '../../components/activity/Analytics.types';

const DAILY = Array.from({ length: 30 }, (_, index) => ({
  date: `2026-11-${String(index + 1).padStart(2, '0')}`,
  count: index % 5 === 0 ? 0 : (index % 4) + 1,
}));

/** A quiet window: twelve payments in thirty days, well under the old fifty-payment floor. */
const QUIET = Array.from({ length: 30 }, (_, index) => ({
  date: `2026-11-${String(index + 1).padStart(2, '0')}`,
  count: index < 12 ? 1 : 0,
}));

const window = {
  days: 30,
  in: '5000.00',
  out: '3750.00',
  net: '1250.00',
  count: 60,
  skipped: 0,
  merchants: [
    { name: 'Java House', count: 5, total: '2500.00' },
    { name: 'Uber', count: 2, total: '1250.00' },
  ],
  busyHours: null,
  received: { count: 4, total: '5000.00', average: '1250.00', median: '1000.00' },
  paidOut: { count: 9, total: '3750.00', average: '416.67', median: '400.00', fee: '75.00' },
  daily: DAILY,
};

/**
 * The reported account: three payments out, nothing in, no fee on any of them.
 *
 * Fee zero as well, because the fee caption has to disappear when there is no fee to caption.
 */
const payerOnly = {
  ...window,
  days: 7,
  in: '0.00',
  out: '148.03',
  net: '-148.03',
  count: 3,
  received: { count: 0, total: '0.00', average: '0.00', median: '0.00' },
  paidOut: { count: 3, total: '148.03', average: '49.34', median: '10.21', fee: '0.00' },
};

const consistency = { activeDays: 3, bestDay: { date: '2026-11-06', count: 2 }, drySpellDays: 6 };
const settled = {
  pending: 0,
  oldestPendingHours: null,
  settledCount: 9,
  medianHours: 0.001,
  worstHours: 2,
};
const waiting = {
  pending: 1,
  oldestPendingHours: 3,
  settledCount: 8,
  medianHours: 0.001,
  worstHours: 2,
};
const customers = {
  count: 3,
  repeat: 2,
  lapsed: 1,
  top: [{ address: '0x5e081234567890abcdef1234567890abcdef1fc5', count: 2, total: '2500.00' }],
};
const oneCustomer = {
  count: 1,
  repeat: 0,
  lapsed: 0,
  top: [{ address: '0x02b02edc794548897cd50d9fb55539197efca1ac', count: 1, total: '96.85' }],
};

export const DayRow = {
  band1: {
    window,
    currency: 'KES',
    windows: [window, { ...window, days: 7 }],
    days: 30,
    onSelect: () => undefined,
    consistency,
    settlement: settled,
  } satisfies AnalyticsSummaryBandProps,

  /** The account in the reported screen: money out only, net negative, no fee. */
  payerOnly: {
    window: payerOnly,
    currency: 'KES',
    windows: [{ ...window, days: 30 }, payerOnly],
    days: 7,
    onSelect: () => undefined,
    consistency,
    settlement: settled,
  } satisfies AnalyticsSummaryBandProps,

  /** The same window with a movement still in flight, which outranks the consistency sentence. */
  waiting: {
    window: payerOnly,
    currency: 'KES',
    windows: [payerOnly],
    days: 7,
    onSelect: () => undefined,
    consistency,
    settlement: waiting,
  } satisfies AnalyticsSummaryBandProps,

  band3: {
    window,
    customers,
    currency: 'KES',
  } satisfies AnalyticsDetailBandProps,

  /** One payer, paid once: nothing has come back and nobody has lapsed. */
  onePayer: {
    window,
    customers: oneCustomer,
    currency: 'KES',
  } satisfies AnalyticsDetailBandProps,

  seriesQuiet: {
    window: { ...window, count: 12, daily: QUIET },
  } satisfies AnalyticsSeriesBandProps,
};
