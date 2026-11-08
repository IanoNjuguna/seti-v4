export const ANALYTICS_COPY = {
  /* Band 1: the period, the answer, and whether to trust it (#441). */
  heroLabel: 'Net',
  heroCaption: (window: string): string => `Money in minus money out, ${window.toLowerCase()}`,
  splitIn: 'Money in',
  splitOut: 'Money out',
  feeCaption: (fee: string): string => `Includes ${fee} fee, funded by you inside your own transfer.`,
  /* Band 2: the shape of the window (#441). */
  seriesTitle: 'Each day',
  halfLine: (label: string, count: number, average: string, median: string): string =>
    `${label}: ${count === 1 ? '1 payment' : `${count} payments`}, average ${average}, median ${median}`,
  seriesBelowFloor: 'Not enough movement in this period to draw a shape.',
  /* Band 3: one list slot, three questions (#441). */
  detailTabLabel: 'Breakdown views',
  detailTabs: { merchants: 'Where it goes', payers: 'Who pays · all time', hours: 'When' } as const,
  merchantsEmpty: 'No payments out in this window.',
  busyBelowFloor:
    'Not enough payments yet to show a rhythm. This appears once there are fifty in the period.',
  busyCount: (count: number): string => (count === 1 ? '1 payment' : `${count} payments`),
  busyPeaks: (peaks: Array<{ weekday: string; fromHour: number; toHour: number }>): string => {
    if (peaks.length === 0) return 'No payments in this period.';
    const named = peaks.map((peak) => `${peak.weekday} ${pad(peak.fromHour)}–${pad(peak.toHour)}`);
    return `Busiest: ${named.join(' · ')}`;
  },
  /* One bar a day (#404). */
  dailyTitle: (days: number): string => (days === 7 ? 'Each day, last 7' : `Each day, last ${days}`),
  dailyPeak: (date: string, count: number): string =>
    `Busiest: ${dayAndMonth(date)} · ${count === 1 ? '1 payment' : `${count} payments`}`,
  dailyCount: (count: number): string => (count === 1 ? '1 payment' : `${count} payments`),
  dayShort: (date: string): string => dayAndMonth(date),
  /* The people on the other side (#396), now the second tab. */
  customersLine: (count: number, repeat: number, lapsed: number): string =>
    `${count === 1 ? '1 wallet has' : `${count} wallets have`} paid you · ${repeat} came back · ${lapsed} not in 30 days`,
  customerPayments: (count: number): string => (count === 1 ? '1 payment' : `${count} payments`),
  /* The panel's states. */
  emptyTitle: 'Nothing in this window',
  emptyBody: 'Payments and transfers will add up here once there are some.',
  errorTitle: "Couldn't load your figures",
  retry: 'Try again',
  loading: 'Loading your figures',
  /** Names band 1 for a screen reader; the visible labels inside it already say what it is. */
  summaryHeading: 'Summary',
  /** Names the window switcher for a screen reader. */
  windowLabel: 'Period',
} as const;

/**
 * How regular the trade is, as one sentence (#393, demoted to a qualifier by #441).
 *
 * The dry spell reads off the ACCOUNT's last movement rather than the selected window, so a quiet
 * fortnight cannot be turned into a clean one by switching to seven days. It is stated as a fact
 * with no colour and no advice: a reading, not a warning.
 */
export function consistencySentence(
  activeDays: number,
  bestDay: { date: string; count: number } | null,
  drySpellDays: number | null
): string {
  const active = `${activeDays} of the last 30 days had a payment`;
  const best = bestDay === null ? '' : `, best on ${dayAndMonth(bestDay.date)} with ${count(bestDay.count)}`;
  if (drySpellDays === null) return `${active}${best}.`;
  return `${active}${best}; last one ${since(drySpellDays)}.`;
}

/**
 * How the settlement is going, as the second half of that sentence (#395).
 *
 * A row is pending because its status says so, not because a receipt is missing: the absence of a
 * receipt is a different fact and one this line would get wrong.
 */
export function settlementSentence(
  pending: number,
  oldestPendingHours: number | null,
  medianHours: number | null
): string {
  if (pending > 0) {
    const oldest = oldestPendingHours === null ? '' : `, oldest ${hours(oldestPendingHours)}`;
    return `${count(pending)}${pending === 1 ? ' movement is' : ' movements are'} still pending${oldest}.`;
  }
  if (medianHours === null) return 'Nothing has settled yet.';
  return `Nothing pending; payments are settling in about ${hours(medianHours)}.`;
}

/**
 * What a window's figures are, in words, when some rows could not be read.
 *
 * `formatFiat` always prints the currency code, so the only thing this builds is the sentence around
 * it: the money itself is never assembled by concatenation. A total that is quietly short is the one
 * failure mode this page must never have, so the count is named rather than swallowed.
 */
export function skippedNote(count: number): string {
  return count === 1
    ? '1 movement could not be read, so the figures may be short by it.'
    : `${count} movements could not be read, so the figures may be short by them.`;
}

/**
 * Below this many movements in the window, a bar chart is a drawing of noise (#404).
 *
 * The same reasoning as the busy-hours floor: a shape inferred from a handful of payments is a
 * pattern that only exists in the sampling, and the tab is better off saying nothing than showing it.
 */
export const DAILY_BAR_FLOOR = 50;

/** `5 payments`, or `1 payment`. */
function count(value: number): string {
  return value === 1 ? '1 payment' : `${value} payments`;
}

/** `today`, `yesterday`, `9 days ago` — a gap, never a bare number. */
function since(days: number): string {
  if (days === 0) return 'today';
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** `09` — an hour on a clock face, not an index. */
export function pad(hour: number): string {
  return String(hour).padStart(2, '0');
}

/** A duration in the unit that makes it readable: seconds, minutes or hours. */
export function hours(value: number): string {
  if (value < 1 / 60) return `${Math.max(1, Math.round(value * 3600))}s`;
  if (value < 1) return `${Math.round(value * 60)}m`;
  if (value < 24) return `${Math.round(value * 10) / 10}h`;
  return `${Math.round((value / 24) * 10) / 10}d`;
}

/** `6 Nov`, from a `YYYY-MM-DD` key, without asking the browser for a locale. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function dayAndMonth(date: string): string {
  const month = Number(date.slice(5, 7)) - 1;
  return `${Number(date.slice(8, 10))} ${MONTHS[month]}`;
}

export function windowLabel(days: number): string {
  return days === 7 ? 'Last 7 days' : `Last ${days} days`;
}
