import type { DailyCount } from '@/lib/api/analytics';

/**
 * The last-n-days series as a calendar grid, and the four steps a cell can take (#369).
 *
 * ## Why weeks are ROWS here, when GitHub's are columns
 *
 * GitHub plots a year, so its columns are weeks and the shape is wide. A merchant's home
 * card plots thirty days, and a three-column-tall strip of thirty squares reads as a
 * sparkline rather than as a calendar. Rotated the other way — weekdays across the top,
 * one row per week — it fills a phone's width, reads like the month grid everyone already
 * knows, and a run of busy days is a run of filled squares sideways instead of a column.
 *
 * ## Blank cells are part of the grid
 *
 * The first and last weeks are padded so every row holds seven cells: without the pads the
 * squares are not under their weekday letters and a Monday looks like a Tuesday. Pads carry
 * `count: null`, which is different from `count: 0`: one is a day outside the window, the
 * other is a day inside it where nothing happened.
 */

/** One cell of the calendar grid. `null` is a pad outside the window, not a quiet day. */
export interface StreakCell {
  /** `YYYY-MM-DD`, or null for the pads that keep the weeks square. */
  date: string | null;
  count: number | null;
}

/** How many of the four steps a day takes. 0 is a quiet day inside the window. */
export type StreakLevel = 0 | 1 | 2 | 3 | 4;

const MONDAY = 1;

/** Monday-first index of a `YYYY-MM-DD` key, in UTC, matching how the server buckets. */
export function weekdayIndex(date: string): number {
  const at = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return (at - MONDAY + 7) % 7;
}

/**
 * The four steps, from a day's count.
 *
 * Absolute, not scaled to the busiest day: a merchant who takes one payment a day should
 * not see every square full because one Saturday was a market day. Four or more is the top
 * step, and the legend says four steps rather than a ratio.
 */
export function levelFor(count: number): StreakLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

/** The series as rows of seven, Monday first, padded at both ends. */
export function streakWeeks(daily: DailyCount[]): StreakCell[][] {
  if (daily.length === 0) return [];

  const cells: StreakCell[] = daily.map((day) => ({ date: day.date, count: day.count }));
  const lead = weekdayIndex(cells[0].date as string);
  const padded: StreakCell[] = [
    ...Array.from({ length: lead }, () => ({ date: null, count: null })),
    ...cells,
  ];
  while (padded.length % 7 !== 0) padded.push({ date: null, count: null });

  const weeks: StreakCell[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  return weeks;
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
