'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { fetchActivityPage } from '@/lib/api/activity';
import { mapRecentToUiTransaction } from '@/hooks/useHomeData';
import { ACTIVITY_PAGE_SIZE } from './Activity.constants';
import { appendPage, countRows, groupByDay } from './activity.format';
import type { ActivityPagesValue, ActivityDayGroup } from './Activity.types';

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

/**
 * The history itself: first page, then more on request.
 *
 * State is written only from promise callbacks (never in an effect body), and the
 * `active` guard stops a page that resolves after unmount from setting state.
 */
export function useActivityPages(userId: string | null): ActivityPagesValue {
  const [groups, setGroups] = useState<ActivityDayGroup[] | null>(null);
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
        setGroups(groupByDay(page.transactions.map(mapRecentToUiTransaction)));
        setHasMore(page.hasMore);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setGroups(null);
        setError(toMessage(cause));
      });

    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const loadMore = useCallback(() => {
    if (!userId || !groups || loadingMore) return;

    setLoadingMore(true);
    fetchActivityPage({ limit: ACTIVITY_PAGE_SIZE, offset: countRows(groups) })
      .then((page) => {
        setGroups((current) =>
          appendPage(current ?? [], page.transactions.map(mapRecentToUiTransaction))
        );
        setHasMore(page.hasMore);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [userId, groups, loadingMore]);

  const retry = useCallback(() => {
    setError(null);
    setGroups(null);
    setAttempt((previous) => previous + 1);
  }, []);

  return { groups, hasMore, loadingMore, error, loadMore, retry };
}
