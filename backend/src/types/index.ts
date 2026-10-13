import type { TransactionType, TransactionStatus } from '@prisma/client';

export { TransactionType, TransactionStatus };

export interface HomeDashboard {
  balance: string;
  currency: string;
  monthToDateDelta: number;
  recentTransactions: RecentTransaction[];
}

export interface RecentTransaction {
  id: string;
  merchant: string;
  category: string;
  /**
   * Which way the money moved, from the ledger's own type.
   *
   * Sent to the client because the sign and the colour are derived from it, and a
   * row that has to infer direction from a display label gets it wrong — every
   * deposit rendered as an outflow before this existed.
   */
  direction: 'in' | 'out';
  amount: string;
  fiatAmount: string | null;
  fiatCurrency: string | null;
  date: Date;
  status: TransactionStatus;
  /**
   * The on-chain hash, when the row has one. Carried so the Activity screen can
   * show the transfer the way an explorer does, and so a row with nothing on
   * chain is visibly journal-only rather than silently so.
   */
  txHash: string | null;
  /** The token this row moved — `pathusd` or `ousd`. */
  asset: string;
  /** The two ends of the transfer, each null when it is not a known address. */
  from: string | null;
  to: string | null;
}

export interface PayRequest {
  amount: string;
  asset: string;
  counterparty: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
