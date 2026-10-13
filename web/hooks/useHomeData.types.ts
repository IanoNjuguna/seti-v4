import type { HomeDashboard, RecentTransaction } from '@/lib/api';
import type { Transaction } from '@/lib/types';

export interface HomeDataState {
  data: HomeDashboard | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export type { RecentTransaction, Transaction };
