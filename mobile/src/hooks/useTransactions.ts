import { useEffect, useState, useCallback } from 'react';
import { fetchTransactions, ApiError } from '@/lib/api';
import type { TransactionItem } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Transaction } from '@/types';

interface UseTransactionsResult {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

function mapToUiTransaction(transaction: TransactionItem): Transaction {
  return {
    id: transaction.id,
    merchant: transaction.merchant,
    category: transaction.category,
    amount: -Number(transaction.amount),
    date: new Date(transaction.date),
    status:
      transaction.status === 'pending' || transaction.status === 'processing'
        ? 'pending'
        : transaction.status === 'failed'
          ? 'failed'
          : 'completed',
  };
}

export function useTransactions(limit = 50): UseTransactionsResult {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchTransactions(limit);
      setTransactions(response.transactions.map(mapToUiTransaction));
    } catch (err) {
      const message = toErrorMessage(err);
      if (__DEV__) {
        console.error('[useTransactions] error', message, err);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isAuthLoading) {
      setLoading(true);
      return;
    }

    if (isAuthenticated) {
      load();
    } else {
      setLoading(false);
      setError('You must be signed in to view your activity.');
    }
  }, [load, isAuthenticated, isAuthLoading]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { transactions, loading, error, refetch: load };
}
