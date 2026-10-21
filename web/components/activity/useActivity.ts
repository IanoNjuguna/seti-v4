'use client';

import { useSession } from '@/lib/auth';
import { useActivityPages } from './useActivityPages';
import type { UseActivityReturn } from './Activity.types';

/**
 * What the Activity screen renders, in one object.
 *
 * The two flags the screen branches on are DERIVED here rather than stored, so
 * they can never disagree with the data: `loading` is "signed in, no page yet, no
 * failure", and `empty` is "a page arrived and it had nothing in it". A stored
 * `loading` boolean is how a fast response ends up flashing a skeleton and then an
 * empty state.
 */
export function useActivity(): UseActivityReturn {
  const session = useSession();
  const userId = session.user?.id ?? null;
  const { bands, hasMore, loadingMore, error, loadMore, retry } = useActivityPages(userId);

  return {
    bands,
    loading: Boolean(userId) && bands === null && error === null,
    loadingMore,
    hasMore,
    error,
    // Every row lands in a band — pending or by month — so an empty band list is
    // exactly an account with no activity.
    empty: bands !== null && bands.length === 0,
    loadMore,
    retry,
  };
}
