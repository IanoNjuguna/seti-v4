/**
 * The publication day, written out (#586).
 *
 * `2026-11-19` → `19 November 2026`, from the STRING, in UTC, never from `new Date()`.
 * Two reasons that matter more than they look:
 *
 *   - the string is the Bank's day, not an instant. Handing it to a local-time `Date` puts
 *     a Nairobi reader nine hours ahead of the label for part of every day, and a page that
 *     prints tomorrow's date over today's rate is the kind of error nobody forgives twice;
 *   - nothing derived from a clock is computed during render here (`modular-ui-authoring`
 *     holds that rule on this runtime), so the server and the browser cannot disagree about
 *     the string they hydrate.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** `19 November 2026`, or `null` when the value is not a publication day. */
export function formatPublicationDay(publishedFor: string | null): string | null {
  if (!publishedFor) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(publishedFor);
  if (!match) return null;

  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return null;

  return `${Number(day)} ${monthName} ${year}`;
}
