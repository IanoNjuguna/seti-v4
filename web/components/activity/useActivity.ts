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
  const { groups, hasMore, loadingMore, error, loadMore, retry } = useActivityPages(userId);

  return {
    groups,
    loading: Boolean(userId) && groups === null && error === null,
    loadingMore,
    hasMore,
    error,
    empty: groups !== null && groups.length === 0,
    loadMore,
    retry,
  };
}
