'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchAnalytics, type AnalyticsSummary } from '@/lib/api/analytics';
import { refusalMessage } from '@/lib/api';
import { longestWindow, paidRecently } from '@/components/home/home.summary';
import type { UseHomeSummaryReturn } from './useHomeSummary.types';

/**
 * Home's summary: what the money did over the longest window the server computes,
 * and who it went to.
 *
 * A SECOND read on the same screen as `useHomeData`, deliberately. The balance and
 * this summary come from different server answers — the balance is the account's
 * position now, the summary is the ledger reconciled over a period — and squashing
 * them into one hook would hide that one of them can fail while the other is fine.
 * Home renders the balance and drops the summary when this read refuses, rather
 * than showing a figure nobody measured.
 *
 * The same three web-runtime rules as `useHomeData`, for the same reasons: no
 * `setState` in the effect body (`react-hooks/set-state-in-effect` is an error in
 * this package), state written only from the request's callbacks, and `active`
 * guarding a response that lands after unmount. `loading` is derived, so a fast
 * answer cannot flash a skeleton.
 */
export function useHomeSummary(userId?: string): UseHomeSummaryReturn {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    fetchAnalytics(userId)
      .then((summary) => {
        if (!active) return;
        setData(summary);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(refusalMessage(cause, 'account'));
      })
      .finally(() => {
        if (active) setSettled(true);
      });

    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const retry = useCallback(() => {
    setSettled(false);
    setAttempt((count) => count + 1);
  }, []);

  if (!userId) {
    return { window: null, merchants: [], currency: '', loading: false, error: null, retry };
  }

  const window = longestWindow(data?.windows ?? []);

  return {
    window,
    merchants: paidRecently(window),
    currency: data?.currency ?? '',
    loading: !settled,
    error,
    retry,
  };
}
