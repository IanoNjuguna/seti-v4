/**
 * Fixed figures for `check:analytics-page`.
 *
 * One window, hand-built so the arithmetic in the assertions is checkable by eye: `in` 5,000 minus
 * `out` 3,750 is the hero's 1,250, `out` carries a 75.00 fee, and the 30 days behind it are quiet on
 * most of them. Nothing here is a claim about a real account; it is a shape to render.
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

/** A quiet window: past the empty state, under the bar-chart floor. */
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

const consistency = { activeDays: 18, bestDay: { date: '2026-11-06', count: 9 }, drySpellDays: 2 };
const settlement = { pending: 0, oldestPendingHours: null, settledCount: 9, medianHours: 0.001, worstHours: 2 };
const customers = {
  count: 3,
  repeat: 2,
  lapsed: 1,
  top: [{ address: '0x5e081234567890abcdef1234567890abcdef1fc5', count: 2, total: '2500.00' }],
};

export const DayRow = {
  band1: {
    window,
    currency: 'KES',
    windows: [window, { ...window, days: 7 }],
    days: 30,
    onSelect: () => undefined,
    consistency,
    settlement,
  } satisfies AnalyticsSummaryBandProps,

  band3: {
    window,
    customers,
    currency: 'KES',
  } satisfies AnalyticsDetailBandProps,

  seriesBelowFloor: {
    window: { ...window, count: 12, daily: QUIET },
    currency: 'KES',
  } satisfies AnalyticsSeriesBandProps,
};
