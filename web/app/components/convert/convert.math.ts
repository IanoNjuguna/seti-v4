/**
 * THE ARITHMETIC `/convert` DOES, as functions (#586).
 *
 * Three rules, and each of them exists because the alternative is a page that lies:
 *
 *   1. A figure the reader types is PARSED or REFUSED, never coerced. `parseFloat('12abc')`
 *      is 12, and a converter that answers a typo with a confident number is worse than one
 *      that answers nothing.
 *   2. The result keeps the precision of the thing it is: shillings to two decimals (a
 *      shilling has 100 cents), a token to six (every Tempo TIP-20 has six). Rounding a
 *      token's gas-sized remainder to two would print `0.00` for money that exists.
 *   3. Nothing here reads a clock, the DOM or the network, so `check:convert-page` can hold
 *      the arithmetic without a browser.
 */

/** The most a reader can type before the page is answering a different question. */
const MAX_AMOUNT = 1_000_000_000;

/** At most six decimals, which is the precision every supported token carries. */
const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,6})?$/;

/**
 * The typed figure, or `null` when it is not an amount.
 *
 * Deliberately strict about the SHAPE rather than relying on `Number()`: an empty field,
 * `1e5`, a leading `+`, a comma thousands separator and a negative all return `null`.
 * None of them is a number a person types into a money field, and each of them would
 * become a plausible-looking answer if it were coerced.
 */
export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value > MAX_AMOUNT) return null;

  return value;
}

/** Shillings for a token amount, at a rate of shillings per dollar. */
export function toShillings(tokenAmount: number, fiatPerUsd: number): number {
  return tokenAmount * fiatPerUsd;
}

/** Tokens for a shilling amount, at a rate of shillings per dollar. */
export function toTokens(shillingAmount: number, fiatPerUsd: number): number {
  return shillingAmount / fiatPerUsd;
}

/**
 * Shillings, written the way every other surface writes them: `KES 12,999.00`.
 *
 * Two decimals always, because a shilling has 100 cents and a payments page that drops
 * them (`KES 12,999`) invites a reader to wonder which cent it kept.
 */
export function formatShillings(amount: number): string {
  if (!Number.isFinite(amount)) return '—';

  const figures = new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `KES ${figures}`;
}

/**
 * A token amount, `25.00000 pathUSD`.
 *
 * Six decimals with the trailing zeros kept: this is a mechanical figure beside a
 * currency figure, and `25 pathUSD` next to `KES 3,239.75` reads as an estimate when both
 * are exact.
 */
export function formatTokens(amount: number, symbol: string): string {
  if (!Number.isFinite(amount)) return '—';

  const figures = new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount);

  return `${figures} ${symbol}`;
}
