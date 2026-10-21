'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/lib/auth';
import { fetchAnalytics, type AnalyticsSummary } from '@/lib/api/analytics';
import type { UseAnalyticsInput, UseAnalyticsReturn } from './Analytics.types';

export function useAnalytics({ active }: UseAnalyticsInput): UseAnalyticsReturn {
  const session = useSession();
  const userId = session.user?.id ?? null;

  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // `data` in the guard is what makes a second visit free: the tab was opened once,
    // the figures are already here, so re-activating the panel must not re-read them.
    if (!active || !userId || data !== null) return;

    let live = true;

    fetchAnalytics(userId)
      .then((summary) => {
        if (live) setData(summary);
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setError(cause instanceof Error ? cause.message : 'Could not load your figures');
      });

    return () => {
      live = false;
    };
  }, [active, userId, attempt, data]);

  const retry = useCallback(() => {
    // Cleared here rather than in the effect: a retry is an event, and an effect that
    // writes state on entry is both a lint error in this app and a second render.
    setError(null);
    setData(null);
    setAttempt((count) => count + 1);
  }, []);

  return {
    data,
    loading: active && Boolean(userId) && data === null && error === null,
    error,
    retry,
  };
}

/** The window the panel is showing. Local, because it is not a place you can link to. */
export function useAnalyticsWindow(data: AnalyticsSummary | null) {
  const [days, setDays] = useState<number>(30);
  const windows = data?.windows ?? [];
  const selected = windows.find((entry) => entry.days === days) ?? windows[0] ?? null;

  return { windows, days: selected?.days ?? days, setDays, selected };
}
