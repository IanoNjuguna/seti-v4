'use client';

import { useEffect, useState } from 'react';
import { fetchHomeDashboard } from '@/lib/api';
import type { AssetBalanceRow } from '@/lib/api';
import type { SpendAssetRowsState } from './useSpendAssetRows.types';

/**
 * Read the balances a payment could spend from.
 *
 * This is the home read, deliberately: it already returns one row per listed asset
 * with its own value at the same rate as the total (#224), so the selector shows the
 * same four balances the customer saw a screen ago instead of a second, narrower
 * read that could disagree with them. Nothing is summed or converted here.
 *
 * `loading` is derived from whether the read has settled, and state is written only
 * from the promise's callbacks — `react-hooks/set-state-in-effect` is an error in
 * this package, and it is right: a synchronous setState in an effect cascades a
 * render.
 *
 * A failed read is NOT a failed payment. The quote is the server's, and it prices
 * from what the account holds whether or not this list arrived — so the failure is
 * reported as `unavailable` and the selector says so in words rather than blocking a
 * payment that would have worked.
 */
export function useSpendAssetRows(userId?: string): SpendAssetRowsState {
  const [rows, setRows] = useState<AssetBalanceRow[]>([]);
  const [currency, setCurrency] = useState('');
  const [settled, setSettled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    fetchHomeDashboard(userId)
      .then((dashboard) => {
        if (!active) return;
        setRows(dashboard.assets);
        setCurrency(dashboard.currency);
        setUnavailable(false);
      })
      .catch(() => {
        if (!active) return;
        setRows([]);
        setUnavailable(true);
      })
      .finally(() => {
        if (active) setSettled(true);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  // No account, no balances to choose between, and no request either: a visitor is
  // never shown another account's money.
  if (!userId) return { rows: [], currency: '', loading: false, unavailable: false };

  return { rows, currency, loading: !settled, unavailable };
}
