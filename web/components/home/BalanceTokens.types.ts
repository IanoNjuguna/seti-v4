import type { AssetBalanceRow } from '@/lib/api/home.types';

export interface BalanceTokensProps {
  /**
   * One row per asset the CHAIN lists, in the server's own order, zeros included.
   * `undefined` while the dashboard has not landed — which renders no list, rather
   * than four rows of zero the read did not measure.
   */
  assets: AssetBalanceRow[] | undefined;
  /**
   * The currency the rows' `value` strings are in: the dashboard's own, passed on
   * untouched. Absent means the payload did not say, and the list is then absent too.
   */
  currency: string | undefined;
  /**
   * A swap from one of these rows was recorded.
   *
   * The balance the card prints is now out of date — two rows changed, not one — so the
   * screen re-reads rather than leaving a figure it knows to be wrong on screen.
   */
  onSwapped?: () => void;
}

/**
 * One rendered row: the name that `units` is denominated in, and the `value` that row
 * contributes to the card's figure.
 */
export interface BalanceTokenRowView {
  /** The ledger's own label, and the list's key. Never shown. */
  asset: string;
  /** The registry's spelling, which IS shown: `pathUSD`, not `pathusd`. */
  name: string;
  /** The asset's own units, formatted. The row's name is this number's unit. */
  units: string;
  /** The row's fiat value, exactly as the payload stated it. Never recomputed. */
  value: string;
  /**
   * True when this row contributes nothing to the figure. It still renders: a row
   * that disappears is how a customer concludes a balance vanished.
   */
  zero: boolean;
}

export interface BalanceTokenRowProps {
  row: BalanceTokenRowView;
  /** The dashboard's currency, for the figure on the right. */
  currency: string;
  /** A swap from THIS row was recorded. See {@link BalanceTokensProps.onSwapped}. */
  onSwapped?: () => void;
}
