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

export interface HomeDashboard {
  balance: string;
  currency: string;
  monthToDateDelta: number;
  recentTransactions: RecentTransaction[];
}
