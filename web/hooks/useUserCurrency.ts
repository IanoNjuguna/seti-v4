'use client';

import { useEffect, useState } from 'react';
import { fetchHomeDashboard } from '@/lib/api';
import { useSession } from '@/lib/auth';

/**
 * The customer's own currency, fetched from the dashboard when a caller needs it.
 *
 * The dashboard is the app's one source of the customer's currency, and two
 * surfaces need it without being handed it:
 *
 *  - a receipt row written before the currency was stored carries none, and a
 *    fiat figure with no currency is a money claim — the card falls back to the
 *    token figure meanwhile;
 *  - the send page labels its amount field with it, so the figure is not
 *    hardcoded into copy.
 *
 * Asked for rather than defaulted — the answer stays null until the backend gives
 * it — and `needed` lets a caller that does not want the request skip it.
 */
export function useUserCurrency(needed: boolean): string | null {
  const session = useSession();
  const userId = session.user?.id ?? null;
  const [currency, setCurrency] = useState<string | null>(null);

  useEffect(() => {
    if (!needed || userId === null) return;

    let active = true;

    fetchHomeDashboard(userId)
      .then((dashboard) => {
        if (active) setCurrency(dashboard.currency);
      })
      .catch(() => {
        // No currency is a state both callers already handle: the receipt prints
        // the token amount and the amount field falls back to plain "Amount".
        if (active) setCurrency(null);
      });

    return () => {
      active = false;
    };
  }, [needed, userId]);

  return currency;
}
