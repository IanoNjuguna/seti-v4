import type { Transaction } from '@/lib/types';
import type { ActivityDayGroup } from './Activity.types';

/**
 * Day grouping, and the labels that go with it.
 *
 * All of it runs AFTER the fetch, never during render: `new Date()` on the server is
 * a different day from the one the customer is looking at, and grouping there would
 * hydrate a different list than it rendered.
 */

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
