import type { SupportedAsset } from '@/lib/chain';

/**
 * The calculator's own words and options (#586).
 *
 * Kept beside the component that prints them, so `check:convert-page` reads the same
 * values the page renders rather than a regex over JSX. The route folder owns the page's
 * copy (masthead, the "what the rate is" rows, the head); this owns what the converter
 * itself says.
 */

/** The four assets the product supports, in the product's own display order. */
export const CONVERT_ASSETS: readonly { asset: SupportedAsset; symbol: string }[] = [
  { asset: 'ousd', symbol: 'OUSD' },
  { asset: 'pathusd', symbol: 'pathUSD' },
  { asset: 'usdt0', symbol: 'USDT0' },
  { asset: 'usdc.e', symbol: 'USDC.e' },
];

/** What the reader converts from on first paint. */
export const DEFAULT_ASSET: SupportedAsset = 'ousd';

/** The unit the figure is expressed in, on each side. */
export const TOKEN_UNIT_FALLBACK = 'USD';
export const SHILLING_UNIT = 'KES';

/** What the reader is doing, and what the verb is for the other way round. */
export const DIRECTIONS = {
  toShillings: { field: 'You have', result: 'In shillings' },
  toTokens: { field: 'You have, in shillings', result: 'In tokens' },
} as const;

export const SWAP_LABEL = 'Swap';
export const AMOUNT_LABEL = 'Amount';
export const AMOUNT_HINT = 'Up to six decimals, which is what the token carries.';

/** Printed beside the rate figure. */
export const RATE_NOTE_PREFIX = '1 USD =';

/** Who published the rate, keyed by the source string the API returns. */
export const RATE_SOURCE_COPY: Record<string, string> = {
  cbk: 'Central Bank of Kenya',
  'open.er-api.com': 'Open Exchange Rates',
  fallback: 'Seti’s own fallback rate',
};

export const RATE_UNAVAILABLE = {
  title: 'The rate could not be read.',
  body: 'The publisher’s figure did not come back, so there is no number here to convert with. Reload to try again.',
} as const;

export const RATE_STALE =
  'This is the most recent rate published. A newer one has not been released yet.';

export const RATE_LOADING = 'Reading the published rate.';

export const NOT_A_QUOTE =
  'Indicative rate, published by the Central Bank of Kenya. Not a quote.';

export const EMPTY_RESULT = '—';
