'use client';

import { useSession } from '@/lib/auth';
import { ACTIVITY_SEARCH_COPY } from './ActivitySearch.constants';
import { countMatches, filterBands } from './activity.search';
import { useActivityPages } from './useActivityPages';
import { useActivitySearch } from './useActivitySearch';
import type { UseActivityReturn } from './Activity.types';

/**
 * What the Activity screen renders, in one object.
 *
 * The two flags the screen branches on are DERIVED here rather than stored, so
 * they can never disagree with the data: `loading` is "signed in, no page yet, no
 * failure", and `empty` is "a page arrived and it had nothing in it". A stored
 * `loading` boolean is how a fast response ends up flashing a skeleton and then an
 * empty state.
 *
 * The query filters the bands here rather than in the page, so the list stays a
 * renderer: the pages it has loaded are never touched, which is what makes
 * clearing a search return the full history without a request and without losing
 * the page. `empty` is about the ACCOUNT and `noMatches` is about the QUERY, and
 * they are never both true: an account with no activity says so once, whatever is
 * typed into the field.
 */
export function useActivity(): UseActivityReturn {
  const session = useSession();
  const userId = session.user?.id ?? null;
  const search = useActivitySearch();
  const { bands: pages, hasMore, loadingMore, error, loadMore, retry } = useActivityPages(userId);

  const bands = pages === null ? null : filterBands(pages, search.query);
  const matches = bands === null ? 0 : countMatches(bands);
  const noRows = pages !== null && pages.length === 0;

  return {
    bands,
    search: { ...search, status: search.query ? ACTIVITY_SEARCH_COPY.match(matches) : '' },
    loading: Boolean(userId) && pages === null && error === null,
    loadingMore,
    hasMore,
    error,
    // Every row lands in a band — pending or by month — so an empty band list is
    // exactly an account with no activity.
    empty: noRows,
    noMatches: bands !== null && !noRows && search.query !== '' && matches === 0,
    loadMore,
    retry,
  };
}
