import type { Transaction } from '@/lib/types';
import type { ActivityBand } from './Activity.types';

/**
 * What a typed query matches, and what it refuses to match.
 *
 * Pure, no React and no request: the rows are already on the screen, and a filter
 * over them is arithmetic, which is the part a screenshot cannot check. Three
 * rules, and every one of them is asserted by `check:activity-search`:
 *
 * 1. Names match as a case-insensitive substring, on the name the wallet signed
 *    for, the counterparty handle, and the counterparty address. There is no
 *    third name: nothing here guesses a display name for an address.
 * 2. Amounts match as digits, without the sign or the separators, so `1,250` and
 *    `1250` find the same row.
 * 3. An amount is only ever consulted when the whole query reads as one. A query
 *    with a letter in it never comes back because of a figure, which is the rule
 *    that stops "aky" from matching a KES 1,250 payment.
 *
 * Substring, not fuzzy: "aki" is a prefix of Akinyi, "kinyi" is inside it, and
 * "aknyi" is a typo this version does not correct (a documented non-goal).
 */

/** Lowercase, trimmed, single-spaced: the form both a name and a query compare in. */
export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** The query without its currency word, thousands separators or spacing. */
function digitsOf(query: string): string {
  return query.replace(/kes/g, '').replace(/[,\s]/g, '');
}

/** True when the whole query could be an amount, and only then may a figure match. */
export function isAmountQuery(query: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(digitsOf(query));
}

/** The names a row was written with: signed, handle, and the address either resolves to. */
function namesOf(transaction: Transaction): string[] {
  return [transaction.merchant, transaction.payeeHandle, transaction.to, transaction.from].filter(
    (value): value is string => Boolean(value)
  );
}

export function matchesQuery(transaction: Transaction, query: string): boolean {
  if (!query) return true;

  if (namesOf(transaction).some((name) => normalizeQuery(name).includes(query))) return true;

  if (!isAmountQuery(query)) return false;

  // The magnitude, two decimals, no separators: the customer types what the row
  // shows and never has to type the minus that the ledger's own sign carries.
  return Math.abs(transaction.amount).toFixed(2).includes(digitsOf(query));
}

/**
 * The bands, pruned to the matches.
 *
 * Pruned rather than rebuilt: an empty month disappears and a partly matching
 * month keeps only its matching days, so the heading a row sits under is still the
 * heading the server's date put it in, and the order stays newest first. A band
 * with nothing left in it is dropped rather than drawn empty.
 */
export function filterBands(bands: ActivityBand[], query: string): ActivityBand[] {
  if (!query) return bands;

  return bands
    .map((band) => ({
      ...band,
      days: band.days
        .map((day) => ({
          ...day,
          transactions: day.transactions.filter((transaction) => matchesQuery(transaction, query)),
        }))
        .filter((day) => day.transactions.length > 0),
    }))
    .filter((band) => band.days.length > 0);
}

/** How many rows are on screen under the current query. */
export function countMatches(bands: ActivityBand[]): number {
  return bands.reduce(
    (total, band) => total + band.days.reduce((sum, day) => sum + day.transactions.length, 0),
    0
  );
}

/**
 * The value to write to `?q=`, or null when there is nothing to write.
 *
 * Null rather than an empty string is what makes clearing really clear: `?q=` left
 * behind is a URL that says a search is happening and shows none of it.
 */
export function queryParam(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}
