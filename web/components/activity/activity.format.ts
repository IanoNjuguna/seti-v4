import type { Transaction } from '@/lib/types';
import type { ActivityBand, ActivityDayGroup } from './Activity.types';

/**
 * Day grouping, month banding, and the labels that go with them.
 *
 * All of it runs AFTER the fetch, never during render: `new Date()` on the server is
 * a different day from the one the customer is looking at, and grouping there would
 * hydrate a different list than it rendered.
 */

/** The band that sorts by STATE rather than by date, so it needs no today. */
const PENDING_BAND = { key: 'pending', label: 'Pending' } as const;

/** The band the customer is living in. Older months are named. */
const THIS_MONTH_LABEL = 'This month';

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/** `Today` / `Yesterday` / a written date — a heading, so no leading preposition. */
export function dayLabel(date: Date, today: Date): string {
  if (sameDay(date, today)) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * `This month` for the month being lived in, then the month's own name.
 *
 * The year appears only when it differs. A ledger that reaches back past a New Year
 * is the one case where `September` alone is ambiguous, and a heading that repeats
 * the current year on every band below it is noise.
 */
export function monthLabel(date: Date, today: Date): string {
  if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()) {
    return THIS_MONTH_LABEL;
  }

  const month = date.toLocaleDateString('en-KE', { month: 'long' });
  return date.getFullYear() === today.getFullYear() ? month : `${month} ${date.getFullYear()}`;
}

/** `2026-8` — a month bucket's key. One day never straddles two months. */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export function groupByDay(transactions: Transaction[], today = new Date()): ActivityDayGroup[] {
  const groups: ActivityDayGroup[] = [];

  for (const transaction of transactions) {
    const key = transaction.date.toDateString();
    const last = groups.at(-1);

    if (last?.key === key) {
      last.transactions.push(transaction);
      continue;
    }

    groups.push({ key, label: dayLabel(transaction.date, today), transactions: [transaction] });
  }

  return groups;
}

/**
 * The coarse bands above the day groups: `Pending` first, then one per month.
 *
 * A pending row LEAVES its date group, whatever its date — that is the whole point
 * of the band, and why a row cannot sit in two places at once. Everything not
 * explicitly pending stays in its month, which is also the fallback the issue asks
 * for: a status the bands do not know about cannot vanish between them.
 *
 * Month buckets collect days in arrival order, so a page boundary inside one month
 * produces one band with two day groups, never two bands for one month.
 */
export function bandsOf(days: ActivityDayGroup[], today = new Date()): ActivityBand[] {
  const pendingDays: ActivityDayGroup[] = [];
  const months = new Map<string, ActivityBand>();

  for (const day of days) {
    const pending = day.transactions.filter((transaction) => transaction.status === 'pending');
    const rest = day.transactions.filter((transaction) => transaction.status !== 'pending');

    if (pending.length > 0) {
      pendingDays.push({ key: day.key, label: day.label, transactions: pending });
    }

    const first = rest[0];
    if (!first) continue;

    const key = monthKey(first.date);
    const existing = months.get(key);

    if (existing) {
      existing.days.push({ key: day.key, label: day.label, transactions: rest });
      continue;
    }

    months.set(key, {
      key,
      label: monthLabel(first.date, today),
      pending: false,
      days: [{ key: day.key, label: day.label, transactions: rest }],
    });
  }

  const monthBands = [...months.values()];

  return pendingDays.length > 0
    ? [{ key: PENDING_BAND.key, label: PENDING_BAND.label, pending: true, days: pendingDays }, ...monthBands]
    : monthBands;
}

/** How many rows are on screen — the offset for the next page. */
export function countRows(groups: ActivityDayGroup[]): number {
  return groups.reduce((total, group) => total + group.transactions.length, 0);
}

/**
 * Adds a page to what is already grouped, keeping one group per day: a page
 * boundary in the middle of a day must not produce two headings for it.
 */
export function appendPage(
  groups: ActivityDayGroup[],
  transactions: Transaction[],
  today = new Date()
): ActivityDayGroup[] {
  const merged = [...groups];

  for (const transaction of transactions) {
    const key = transaction.date.toDateString();
    const last = merged.at(-1);

    if (last?.key === key) {
      last.transactions.push(transaction);
      continue;
    }

    merged.push({ key, label: dayLabel(transaction.date, today), transactions: [transaction] });
  }

  return merged;
}
