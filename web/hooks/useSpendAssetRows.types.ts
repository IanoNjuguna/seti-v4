import type { AssetBalanceRow } from '@/lib/api';

/**
 * The balances a payment can come from, as the home read answers them (#224/#228).
 *
 * One row per asset the chain lists, each with its own value in the dashboard's
 * currency — one read, one rate, so the rows add up to the figure the customer
 * already trusts on home. The selector draws these and nothing else.
 */
export interface SpendAssetRowsState {
  rows: AssetBalanceRow[];
  /** The currency the rows are valued in, or '' until the read has answered. */
  currency: string;
  /** True until the first read settles, so the selector can draw its own shape. */
  loading: boolean;
  /** The read failed. The payment still prices; the choice is what is missing. */
  unavailable: boolean;
}
