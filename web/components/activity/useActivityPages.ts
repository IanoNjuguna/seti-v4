'use client';

import { useCallback, useEffect, useState } from 'react';
import { refusalMessage } from '@/lib/api';
import { fetchActivityPage } from '@/lib/api/activity';
import { mapRecentToUiTransaction } from '@/hooks/useHomeData';
import { ACTIVITY_PAGE_SIZE } from './Activity.constants';
import { appendPage, bandsOf, countRows, groupByDay } from './activity.format';
import type { ActivityBand, ActivityDayGroup, ActivityPagesValue } from './Activity.types';

/** Our copy for a failed page, mapped from the code. Never the server's words. */
function toMessage(error: unknown): string {
  return refusalMessage(error, 'activity');
}

/**
 * Days and the bands above them, as ONE value.
 *
 * They are derived together, after the fetch, so they are stored together: two
 * pieces of state would let a page land in the days list and not in the bands, and
 * the list would be missing rows it had already counted toward the next offset.
 */
interface ActivityPages {
  days: ActivityDayGroup[];
  bands: ActivityBand[];
}

/** The page's rows, grouped and banded against one `today`. */
function buildPage(transactions: ReturnType<typeof mapRecentToUiTransaction>[]): ActivityPages {
  const today = new Date();
  const days = groupByDay(transactions, today);

  return { days, bands: bandsOf(days, today) };
}

/**
 * The history itself: first page, then more on request.
 *
 * State is written only from promise callbacks (never in an effect body), and the
 * `active` guard stops a page that resolves after unmount from setting state.
 */
export function useActivityPages(userId: string | null): ActivityPagesValue {
  const [pages, setPages] = useState<ActivityPages | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    fetchActivityPage({ limit: ACTIVITY_PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (!active) return;
        setPages(buildPage(page.transactions.map(mapRecentToUiTransaction)));
        setHasMore(page.hasMore);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setPages(null);
        setError(toMessage(cause));
      });

    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const loadMore = useCallback(() => {
    if (!userId || !pages || loadingMore) return;

    setLoadingMore(true);
    fetchActivityPage({ limit: ACTIVITY_PAGE_SIZE, offset: countRows(pages.days) })
      .then((page) => {
        const appended = page.transactions.map(mapRecentToUiTransaction);
        setPages((current) => {
          if (!current) return current;
          const today = new Date();
          const days = appendPage(current.days, appended, today);

          return { days, bands: bandsOf(days, today) };
        });
        setHasMore(page.hasMore);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [userId, pages, loadingMore]);

  const retry = useCallback(() => {
    setError(null);
    setPages(null);
    setAttempt((previous) => previous + 1);
  }, []);

  return { bands: pages?.bands ?? null, hasMore, loadingMore, error, loadMore, retry };
}
