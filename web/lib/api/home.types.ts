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
}

/**
 * One asset's share of the balance.
 *
 * Amounts are in the asset's OWN units and carry no currency: the total above is the
 * one figure that is money. The symbol is the registry's spelling, never the token
 * contract's own claim about itself.
 */
export interface AssetBalanceRow {
  asset: string;
  symbol: string;
  amount: string;
}

export interface HomeDashboard {
  balance: string;
  currency: string;
  /** What the balance is made of: one row per asset the chain lists, largest first. */
  assets: AssetBalanceRow[];
  monthToDateDelta: number;
  recentTransactions: RecentTransaction[];
}
