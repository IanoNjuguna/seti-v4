'use client';

import { useCallback, useEffect, useState } from 'react';
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
 *
 * `reload` exists for the one moment the figures are KNOWN to be stale: after a swap
 * has moved a balance (#593). It bumps a nonce from an event handler, which is a legal
 * setState, and the effect below is what re-reads. Without it a finished swap left the
 * old balance on screen while the success sentence claimed an update nobody performed.
 */
export function useSpendAssetRows(userId?: string): SpendAssetRowsState {
  const [rows, setRows] = useState<AssetBalanceRow[]>([]);
  const [currency, setCurrency] = useState('');
  const [settled, setSettled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [read, setRead] = useState(0);

  const reload = useCallback(() => setRead((count) => count + 1), []);

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
  }, [userId, read]);

  // No account, no balances to choose between, and no request either: a visitor is
  // never shown another account's money.
  if (!userId) return { rows: [], currency: '', loading: false, unavailable: false, reload };

  return { rows, currency, loading: !settled, unavailable, reload };
}
