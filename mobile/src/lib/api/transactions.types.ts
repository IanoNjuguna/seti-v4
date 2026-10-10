import type { TransactionStatus } from './home.types';

export interface TransactionItem {
  id: string;
  merchant: string;
  category: string;
  amount: string;
  fiatAmount: string | null;
  fiatCurrency: string | null;
  date: string;
  status: TransactionStatus;
}

export interface TransactionsResponse {
  transactions: TransactionItem[];
}
