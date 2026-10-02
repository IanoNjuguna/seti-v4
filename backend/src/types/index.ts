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
  amount: string;
  fiatAmount: string | null;
  fiatCurrency: string | null;
  date: Date;
  status: TransactionStatus;
}

export interface PayRequest {
  amount: string;
  asset: string;
  counterparty: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
