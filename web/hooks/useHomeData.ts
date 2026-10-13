'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchHomeDashboard } from '@/lib/api';
import type { HomeDashboard, RecentTransaction } from '@/lib/api';
import type { Transaction } from '@/lib/types';
import type { HomeDataState } from './useHomeData.types';

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

const SIGNED_OUT = 'You must be signed in to view your account.';

/**
 * Ported from `mobile/src/hooks/useHomeData.ts`.
 *
 * Four deliberate differences from the mobile hook:
 *
 * 1. **Auth is an argument, not a context.** Mobile reads
 *    `useAuth().isAuthenticated`; web auth is not wired yet, so `userId` comes
 *    in as a prop. Missing is a real state, not a bug — which is why the
 *    signed-out answer is derived during render instead of pushed into state.
 * 2. **No setState in the effect body.** `react-hooks/set-state-in-effect` is an
 *    *error* here, and the rule is right: a synchronous setState in an effect
 *    cascades a render. State is only written from the request's callbacks.
 * 3. **The request is cancellable.** Mobile can set state after unmount; this
 *    guards with `active` so a slow response cannot write to a dead component.
 * 4. **`loading` is derived** from whether a request has settled, so there is no
 *    separate flag to keep in sync.
 */
export function useHomeData(userId?: string): HomeDataState {
  const [data, setData] = useState<HomeDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    fetchHomeDashboard(userId)
      .then((dashboard) => {
        if (!active) return;
        setData(dashboard);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setData(null);
        setError(toErrorMessage(err));
      })
      .finally(() => {
        if (active) setSettled(true);
      });

    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  const refetch = useCallback(() => {
    setSettled(false);
    setReloadKey((key) => key + 1);
  }, []);

  if (!userId) {
    return { data: null, loading: false, error: SIGNED_OUT, refetch };
  }

  return { data, loading: !settled, error, refetch };
}

/**
 * API row to UI row.
 *
 * `amount` is negated because a payment is an outflow, and the status collapses
 * to the three the UI renders: `processing` and `pending` both mean "waiting on
 * the chain" to a customer, and `reversed` reads as failed.
 *
 * The figure shown is the row's own fiat amount when it has one, falling back to
 * the stablecoin amount for rows written before the fiat figures existed. A row
 * with no fiat figure is USD-denominated, because that is what the asset is — so
 * it is labelled USD rather than the customer's currency. Naming a currency the
 * figure is not in is the bug this replaced: a KES 1,000
 * payment displayed as "KES 7.69". Both are stored; this picks the one the
 * format is for.
 *
 * Dates stay as `Date`; the row formats them. That is safe from a hydration
 * mismatch only because the first render is the loading state and the rows
 * appear after the fetch, on the client.
 */
export function mapRecentToUiTransaction(transaction: RecentTransaction): Transaction {
  const fiat = transaction.fiatAmount;
  const isInflow = transaction.direction === 'in';

  // The magnitude, never the sign: the row derives its sign and colour from
  // `direction`. Carrying money IN as a negative number is how a deposit came to
  // render as a loss.
  const magnitude = Number(fiat ?? transaction.amount);

  return {
    id: transaction.id,
    merchant: transaction.merchant,
    category: transaction.category,
    amount: isInflow ? magnitude : -magnitude,
    direction: transaction.direction,
    // A row with a fiat figure is in the currency it was recorded in; a row
    // without one is the stablecoin amount, which is denominated in USD.
    currency: fiat === null || fiat === undefined ? 'USD' : (transaction.fiatCurrency ?? 'USD'),
    date: new Date(transaction.date),
    status:
      transaction.status === 'pending' || transaction.status === 'processing'
        ? 'pending'
        : transaction.status === 'completed'
          ? 'completed'
          : 'failed',
    txHash: transaction.txHash,
    asset: transaction.asset,
    from: transaction.from,
    to: transaction.to,
  };
}
