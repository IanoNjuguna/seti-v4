export type TransactionStatus = 'completed' | 'pending' | 'processing' | 'failed' | 'reversed';

export interface RecentTransaction {
  id: string;
  merchant: string;
  category: string;
  amount: string;
  fiatAmount: string | null;
  fiatCurrency: string | null;
  date: string;
  status: TransactionStatus;
}

export interface HomeDashboard {
  balance: string;
  currency: string;
  monthToDateDelta: number;
  recentTransactions: RecentTransaction[];
}
