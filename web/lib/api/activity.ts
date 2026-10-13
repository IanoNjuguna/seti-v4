import type { RecentTransaction, RecentTransactionStatus } from './home.types';
import { get } from './client';

/**
 * One page of the customer's history.
 *
 * The rows are the SAME shape the dashboard's short list uses, from the same
 * server-side mapper — so a transfer cannot be called one thing on the home card
 * and another in Activity.
 */
export interface ActivityPage {
  transactions: RecentTransaction[];
  /** True when the server has more rows after this page. */
  hasMore: boolean;
}

export interface FetchActivityPageInput {
  limit: number;
  offset: number;
}

export function fetchActivityPage({
  limit,
  offset,
}: FetchActivityPageInput): Promise<ActivityPage> {
  return get<ActivityPage>(`/transactions?limit=${limit}&offset=${offset}`);
}

export type { RecentTransaction, RecentTransactionStatus };
