/** Mirrors `mobile/src/lib/api/home.types.ts` — the backend's contract. */

export type RecentTransactionStatus =
  | 'completed'
  | 'pending'
  | 'processing'
  | 'failed'
  | 'reversed';

export interface RecentTransaction {
  id: string;
  merchant: string;
  category: string;
  /** `in` for money arriving, `out` for money leaving. Drives the row's sign. */
  direction: 'in' | 'out';
  amount: string;
  fiatAmount: string | null;
  fiatCurrency: string | null;
  date: string;
  status: RecentTransactionStatus;
  /** The on-chain hash, when the row has one. Null for a journal-only row. */
  txHash: string | null;
  /** The token this row moved — a label such as `ousd`, `pathusd`, `usdt0` or `usdc.e`.
   * A label on the transfer, never a filter on which wallet it came from. */
  asset: string;
  /** Both ends of the transfer, each null when it is not a known address. */
  from: string | null;
  to: string | null;
  /**
   * The name this person was resolved from, when the row has one.
   *
   * A label the customer saw, never how the money was routed. It exists because an
   * address cannot be resolved back to a name, so a failed row without this can
   * only offer a `0x…` the send flow cannot be pointed at.
   */
  payeeHandle: string | null;
}

/**
 * One asset's share of the balance, with its own value.
 *
 * `amount` is in the asset's own units, exactly as the ledger holds it; `value` is
 * that amount in the dashboard's currency, at the same rate as the total. The two
 * come from one read, and the total is the sum of these `value` strings — so a row
 * surface can print the rows and trust that they add up to the figure on the card.
 *
 * The symbol is the registry's spelling, never the token contract's own claim.
 */
export interface AssetBalanceRow {
  asset: string;
  symbol: string;
  amount: string;
  /** This row's own value, in the dashboard's currency. */
  value: string;
}

export interface HomeDashboard {
  /** The one money figure: the sum of `assets[].value`. */
  balance: string;
  currency: string;
  /** What the balance is made of: one row per asset the chain lists, largest first. */
  assets: AssetBalanceRow[];
  monthToDateDelta: number;
  recentTransactions: RecentTransaction[];
}
