import { useEffect, useState, useCallback } from 'react';
import { fetchHomeDashboard, ApiError } from '@/lib/api';
import type { HomeDashboard, RecentTransaction } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Transaction } from '@/types';

interface HomeDataState {
  data: HomeDashboard | null;
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

export function useHomeData(userId?: string): HomeDataState {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const effectiveUserId = userId ?? user?.id;

  const [data, setData] = useState<HomeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!effectiveUserId) {
      setLoading(false);
      setError('You must be signed in to view your account.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (__DEV__) {
        console.log('[useHomeData] fetching dashboard for', effectiveUserId);
      }
      const dashboard = await fetchHomeDashboard(effectiveUserId);
      if (__DEV__) {
        console.log('[useHomeData] received', dashboard);
      }
      setData(dashboard);
    } catch (err) {
      const message = toErrorMessage(err);
      if (__DEV__) {
        console.error('[useHomeData] error', message, err);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  // Load the dashboard once auth is ready. This effect owns the initial fetch
  // lifecycle and is the standard pattern for self-contained data hooks.
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
      setError('You must be signed in to view your account.');
    }
  }, [load, isAuthenticated, isAuthLoading]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { data, loading, error, refetch: load };
}

export function mapRecentToUiTransaction(transaction: RecentTransaction): Transaction {
  return {
    id: transaction.id,
    merchant: transaction.merchant,
    category: transaction.category,
    amount: -Number(transaction.amount),
    date: new Date(transaction.date),
    status: transaction.status === 'pending' || transaction.status === 'processing'
      ? 'pending'
      : transaction.status === 'failed'
        ? 'failed'
        : 'completed',
  };
}
