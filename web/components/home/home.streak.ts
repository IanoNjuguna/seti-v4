import type { DailyCount } from '@/lib/api/analytics';

/**
 * A year of days as columns of seven, and the four steps a cell can take (#371).
 *
 * ## Weeks are COLUMNS here, because the span is a year
 *
 * The first cut plotted thirty days with weeks as rows, which is right for a month: seven
 * columns across a phone is the grid a reader already knows. A year drawn that way is three
 * hundred rows deep. Rotated — one column per week, seven rows for the weekdays, the way a
 * contribution graph is drawn everywhere — a year is fifty-three columns wide and fills the
 * card it sits in instead of leaving two thirds of the row empty.
 *
 * ## Blank cells are the ends of the first and last week
 *
 * The first column starts on the weekday the series starts on, so the cells above it are pads.
 * Without them a Monday sits in the Tuesday row and every day after it is a day out. A pad
 * carries `count: null`, which is different from `count: 0`: one is a day outside the window,
 * the other is a day inside it where nothing happened.
 */

/** One cell of the grid. `null` is a pad outside the window, not a quiet day. */
export interface StreakCell {
  /** `YYYY-MM-DD`, or null for the pads that keep the columns square. */
  date: string | null;
  count: number | null;
  /**
   * A day still to come (#389). The map is a full year from the day the account joined, so most of
   * it is ahead for a new merchant: those cells are drawn as an outline, which is neither a quiet
   * day nor a pad — the day exists, it just has not been lived yet.
   */
  ahead: boolean;
}

/** The UTC day a cell is compared against, so "ahead" cannot drift with the reader's clock. */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** How many of the four steps a day takes. 0 is a quiet day inside the window. */
export type StreakLevel = 0 | 1 | 2 | 3 | 4;

const MONDAY = 1;

/** One letter per month, for the row above the grid. */
export const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

/** Spelled out for the period label, where `4 Nov` has room to be a date. */
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * What period the strip covers, in the words the strip deserves (#375).
 *
 * A merchant three days old was shown `Last 12 months` over a year of empty squares. The window
 * now starts at their first payment, so the label says what it is: `Since 4 Nov` while the account
 * is young, `Last 12 months` once the window is a full year.
 */
export function stripLabel(days: number, firstDate: string | undefined): string {
  if (days >= 365) return 'Last 12 months';
  if (!firstDate) return 'No payments yet';
  const month = Number(firstDate.slice(5, 7)) - 1;
  return `Since ${Number(firstDate.slice(8, 10))} ${MONTH_SHORT[month]}`;
}

/**
 * What the map's own year is called (#389).
 *
 * The strip is always a full year now, and the FIRST year of an account is different from the last
 * twelve months of an old one: its days ahead are unnamed. `Your first year` says that the empty
 * squares on the right are days to come rather than days missed. Nothing paid yet still says so,
 * because a label about a period is not an answer to "did anything happen".
 */
export function windowLabel(year: { days: number; daily: DailyCount[]; payments: number }, today = todayKey()): string {
  if (year.payments === 0) return 'No payments yet';
  const last = year.daily.at(-1)?.date;
  if (last && last > today) return 'Your first year';
  return stripLabel(year.days, year.daily[0]?.date);
}

/** Monday-first index of a `YYYY-MM-DD` key, in UTC, matching how the server buckets. */
export function weekdayIndex(date: string): number {
  const at = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return (at - MONDAY + 7) % 7;
}

/**
 * The four steps, from a day's count.
 *
 * Absolute, not scaled to the busiest day: a merchant who takes one payment a day should not see
 * every square full because one Saturday was a market day. Four or more is the top step, and the
 * legend says four steps rather than a ratio.
 */
export function levelFor(count: number): StreakLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

/**
 * The series as columns of seven, Monday first, padded at the start and the end.
 *
 * Column-major because that is what the grid draws: `grid-flow-col` fills down a column before
 * starting the next, which is the order the days arrived in.
 */
export function streakColumns(daily: DailyCount[], today = todayKey()): StreakCell[][] {
  if (daily.length === 0) return [];

  const cells: StreakCell[] = daily.map((day) => ({
    date: day.date,
    count: day.count,
    ahead: day.date > today,
  }));
  const lead = weekdayIndex(cells[0].date as string);
  const padded: StreakCell[] = [
    ...Array.from({ length: lead }, () => ({ date: null, count: null, ahead: false })),
    ...cells,
  ];
  while (padded.length % 7 !== 0) padded.push({ date: null, count: null, ahead: false });

  const columns: StreakCell[][] = [];
  for (let i = 0; i < padded.length; i += 7) columns.push(padded.slice(i, i + 7));
  return columns;
}

/**
 * Which column each month starts in, for the row above the grid.
 *
 * A month is labelled at the first cell that belongs to it, and a month that starts in the first
 * column is dropped: a label under the very first square is where the eye already is, and the
 * grid's own left edge says the same thing.
 */
export function monthMarks(columns: StreakCell[][]): Array<{ column: number; label: string }> {
  const marks: Array<{ column: number; label: string }> = [];
  let lastMonth = -1;

  columns.forEach((column, index) => {
    const first = column.find((cell) => cell.date !== null);
    if (!first?.date) return;
    const month = Number(first.date.slice(5, 7)) - 1;
    if (month === lastMonth) return;
    lastMonth = month;
    if (index === 0) return;
    marks.push({ column: index + 1, label: MONTH_INITIALS[month] });
  });

  return marks;
}

/** How many days in the window carried at least one payment, and how many there were. */
export function streakTotals(daily: DailyCount[]): { activeDays: number; payments: number } {
  return daily.reduce(
    (totals, day) => ({
      activeDays: totals.activeDays + (day.count > 0 ? 1 : 0),
      payments: totals.payments + day.count,
    }),
    { activeDays: 0, payments: 0 }
  );
}
