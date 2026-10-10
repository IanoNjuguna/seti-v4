import { get } from './client';
import type { TransactionsResponse } from './transactions.types';

export async function fetchTransactions(
  limit = 50,
  offset = 0
): Promise<TransactionsResponse> {
  return get<TransactionsResponse>(`/transactions?limit=${limit}&offset=${offset}`);
}
