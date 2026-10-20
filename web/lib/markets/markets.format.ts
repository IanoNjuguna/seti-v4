/**
 * Every figure the Markets surface prints is formatted HERE, on the server, and
 * shipped as a finished string.
 *
 * The reason is the one the repo already paid for elsewhere: nothing derived
 * from a clock may be computed during render, because the server renders with its
 * own clock and every visitor in a different timezone then hydrates a different
 * string. `closesLabel` and the refresh line are therefore decided in the route
 * handler, where "now" is a parameter and not an ambient fact.
 *
 * Nothing here is money a customer holds: there is no currency conversion and no
 * balance. These are prices (0..1) and volumes in dollars of the venue's own
 * notional, so `formatFiat` would be the wrong tool and the wrong claim.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A 0..1 price as the percentage a reader expects: `0.405` -> `40%`.
 *
 * The extremes are not rounded to `0%` or `100%`: a live market at 0.3c is a long
 * shot, not a settled loser, and printing `0%` on something still trading is a
 * false statement about what the venue thinks.
 */
export function formatProbability(price: number | null): string {
  if (price === null || Number.isNaN(price)) return '—';
  if (price > 0 && price < 0.005) return '<1%';
  if (price < 1 && price > 0.995) return '>99%';
  return `${Math.round(price * 100)}%`;
}

/** `1234567` -> `$1.2M`. Compact because a row is 13px wide, not a statement. */
export function formatCompactUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '$0';
  if (amount >= 1_000_000_000) return `$${trim(amount / 1_000_000_000)}B`;
  if (amount >= 1_000_000) return `$${trim(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${trim(amount / 1_000)}k`;
  return `$${Math.round(amount)}`;
}

/** One decimal, and only when it says something: `1.0M` is noise, `1.2M` is not. */
function trim(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Spread in points of a dollar: `0.01` -> `1.0c`. */
export function formatSpread(spread: number | null): string {
  if (spread === null || Number.isNaN(spread)) return '—';
  return `${(spread * 100).toFixed(1)}c`;
}

/**
 * When an event closes, relative to a "now" the caller supplies.
 *
 * `Closes today` and `Closes 31 Oct` are both true statements about the same field;
 * which one is used depends only on the gap, so passing `now` keeps the function
 * pure and the server's clock the only clock involved.
 */
export function formatClosesLabel(endDate: string | null | undefined, now: Date): string {
  if (!endDate) return 'Closing date not set';
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return 'Closing date not set';

  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDay = (date: Date): number =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const days = Math.round((startOfDay(end) - startOfDay(now)) / dayMs);

  if (days < 0) return 'Closed';
  if (days === 0) return 'Closes today';
  if (days === 1) return 'Closes tomorrow';
  if (days <= 7) return `Closes in ${days} days`;
  return `Closes ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]}`;
}

/** `14:32 UTC` — a wall clock, so "refreshed" can never mean "just now, probably". */
export function formatRefreshClock(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'just now';
  const hours = String(at.getUTCHours()).padStart(2, '0');
  const minutes = String(at.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes} UTC`;
}
