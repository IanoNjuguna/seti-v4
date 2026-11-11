export const ANALYTICS_COPY = {
  /* Band 1: the period, the answer, and whether to trust it (#441, #534). */
  heroIn: 'Money in',
  heroOut: 'Money out',
  heroCaption: (window: string): string => window.toLowerCase(),
  figures: {
    payments: 'Payments',
    typical: 'Typical payment',
    net: 'Net',
  } as const,
  splitIn: 'Money in',
  splitOut: 'Money out',
  feeCaption: (fee: string): string => `Includes ${fee} fee, funded by you inside your own transfer.`,
  /* Band 2: the shape of the window (#441). */
  seriesTitle: 'Payments per day',
  /* Band 3: one list slot, three questions (#441). */
  detailTabLabel: 'Breakdown views',
  /**
   * The all-time list is no longer named in its own label (#534).
   *
   * `Who pays · all time` carried a scope inside a tab, which made one member of a
   * three-member switcher longer than the other two and put a qualifier where a name
   * belongs. The scope is a fact about the list, so it is stated above the list.
   */
  detailTabs: { merchants: 'Where it goes', payers: 'Who pays', hours: 'When' } as const,
  payersScope: 'Since your first payment',
  merchantsEmpty: 'No payments out in this window.',
  busyBelowFloor:
    'Not enough payments yet to show a rhythm. This appears once there are fifty in the period.',
  busyCount: (count: number): string => payments(count),
  busyPeaks: (peaks: Array<{ weekday: string; fromHour: number; toHour: number }>): string => {
    if (peaks.length === 0) return 'No payments in this period.';
    const named = peaks.map((peak) => `${peak.weekday} ${pad(peak.fromHour)}–${pad(peak.toHour)}`);
    return `Busiest: ${named.join(' · ')}`;
  },
  /* One bar a day (#404). */
  dailyPeak: (date: string, count: number): string =>
    `Busiest: ${dayAndMonth(date)} · ${payments(count)}`,
  dailyCount: (count: number): string => payments(count),
  dayShort: (date: string): string => dayAndMonth(date),
  /* The people on the other side (#396), now the second tab. */
  /**
   * What the payer list counts, in the terms the ledger can prove (#534).
   *
   * `0 came back · 0 not in 30 days` printed two absences beside one presence, and a
   * line of zeroes reads as a broken read rather than as a small account. Only the
   * facts that exist are printed now: a single payer who has paid once gets one clause.
   */
  customersLine: (count: number, repeat: number, lapsed: number): string => {
    const paid = count === 1 ? '1 wallet has paid you' : `${count} wallets have paid you`;
    const back = repeat === 0 ? '' : ` · ${repeat === 1 ? '1 came back' : `${repeat} came back`}`;
    const gone =
      lapsed === 0
        ? ''
        : ` · ${lapsed === 1 ? '1 has not paid in 30 days' : `${lapsed} have not paid in 30 days`}`;
    return `${paid}${back}${gone}`;
  },
  customerPayments: (count: number): string => payments(count),
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
 * Which figure band 1 leads with, and the amount beside it (#534).
 *
 * Money IN when anything came in, because that is the number a merchant is in business
 * for, and it is what every payment product in this class leads with: Stripe's gross
 * revenue, Whop's, Kajabi's, HoneyBook's booked amount.
 *
 * A window with NO inflow leads with money OUT rather than with a negative net. An
 * account that paid three merchants and received nothing this week is doing something
 * ordinary, and a page whose largest figure is `-KES 148.03`, captioned "money in minus
 * money out", has told them they lost money. Net keeps its place among the figures below,
 * where the subtraction sits beside its own operands and reads as arithmetic rather than
 * as a verdict on the week.
 */
export function heroDirection(window: { in: string; out: string }): {
  label: string;
  value: string;
  half: 'received' | 'paidOut';
} {
  const inflow = Number(window.in) || 0;

  return inflow > 0
    ? { label: ANALYTICS_COPY.heroIn, value: window.in, half: 'received' }
    : { label: ANALYTICS_COPY.heroOut, value: window.out, half: 'paidOut' };
}

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
  const best =
    bestDay === null ? '' : `, best on ${dayAndMonth(bestDay.date)} with ${payments(bestDay.count)}`;
  if (drySpellDays === null) return `${active}${best}.`;
  return `${active}${best}; last one ${since(drySpellDays)}.`;
}

/**
 * How the settlement is going (#395).
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
    const inFlight = pending === 1 ? '1 movement is' : `${pending} movements are`;
    return `${inFlight} still pending${oldest}.`;
  }
  if (medianHours === null) return 'Nothing has settled yet.';
  return `Nothing pending; payments are settling in about ${hours(medianHours)}.`;
}

/**
 * The ONE sentence a window gets about whether its figures can be trusted (#534).
 *
 * Consistency and settlement used to print as two sentences in one paragraph, under a fee
 * caption, an average-and-median line and two "not enough" notes: five explanations between
 * the figure and the first list. A page that explains itself five times reads as a page with
 * nothing to say.
 *
 * So the two are ranked rather than joined. A movement still pending is a live fact about this
 * money and wins; with nothing pending, the honest sentence is how regular the trade has been.
 * Settlement speed is not a second subject worth a second line: an account that settles in a
 * second does not need telling on every visit.
 */
export function qualifierSentence(
  consistency: {
    activeDays: number;
    bestDay: { date: string; count: number } | null;
    drySpellDays: number | null;
  },
  settlement: {
    pending: number;
    oldestPendingHours: number | null;
    medianHours: number | null;
  }
): string {
  if (settlement.pending > 0) {
    return settlementSentence(
      settlement.pending,
      settlement.oldestPendingHours,
      settlement.medianHours
    );
  }
  return consistencySentence(consistency.activeDays, consistency.bestDay, consistency.drySpellDays);
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
 * How many payments band 2 needs before it draws the days.
 *
 * ONE (#534). It used to be fifty: below that the band printed "Not enough movement in this
 * period to draw a shape" and drew nothing, which meant that for every account in its first
 * months the only visual thing on the page was missing. The repo has already ruled on this
 * shape once: `HomeSummary` keeps its map for a three-day account, because "a sentence
 * instead of the grid" was the defect (#381).
 *
 * The floor's original reasoning is not wrong, it is answered elsewhere: a shape drawn from a
 * handful of payments is noise, so the marks are drawn sparse (one bar a day, zero days
 * included, each a real fact about that day) and the busiest day is named in words underneath.
 * Nothing here asks the reader to infer a trend from four bars.
 */
export const DAILY_MARK_FLOOR = 1;

/** `5 payments`, or `1 payment`. */
function payments(value: number): string {
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
