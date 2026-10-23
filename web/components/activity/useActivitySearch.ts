'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ACTIVITY_SEARCH_PARAM, ACTIVITY_SEARCH_WRITE_MS } from './ActivitySearch.constants';
import { normalizeQuery, queryParam } from './activity.search';
import type { ActivitySearchBase } from './ActivitySearch.types';

/**
 * The query, read from and written to the URL exactly as `?view=` is.
 *
 * The URL is the state, not a mirror of it: a result survives reload, can be sent
 * to someone, and Back still leaves the page rather than stepping through the
 * letters that were typed. The write is `replace` for the same reason the view's
 * is: narrowing a list is looking at the same page differently, not navigating.
 *
 * It is also written after a pause (`ACTIVITY_SEARCH_WRITE_MS`) while the list
 * filters on every character. Typing therefore never waits for history, and a
 * cleared query deletes the parameter instead of leaving `?q=` behind.
 *
 * The value starts from the URL so a reload or a shared link opens with the
 * search already applied and the field already full.
 */
export function useActivitySearch(): ActivitySearchBase {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [value, setValue] = useState(() => params.get(ACTIVITY_SEARCH_PARAM) ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next = queryParam(value);
    if (next === params.get(ACTIVITY_SEARCH_PARAM)) return;

    const timer = setTimeout(() => {
      /**
       * Read from the live URL, not from the `params` this effect closed over.
       * Switching to Analytics inside the pause is a different write from the same
       * tick, and a snapshot taken before it would drop `?view=analytics` when this
       * one lands — the reader would type a query, tap the tab, and find themselves
       * back on the list with their query.
       */
      const search = new URLSearchParams(window.location.search);

      if (next) search.set(ACTIVITY_SEARCH_PARAM, next);
      else search.delete(ACTIVITY_SEARCH_PARAM);

      const written = search.toString();
      router.replace(written ? `${pathname}?${written}` : pathname, { scroll: false });
    }, ACTIVITY_SEARCH_WRITE_MS);

    return () => clearTimeout(timer);
  }, [value, params, pathname, router]);

  /** Clearing is one action from three places, so it returns the caret to the field. */
  const clear = useCallback(() => {
    setValue('');
    inputRef.current?.focus();
  }, []);

  return { value, query: normalizeQuery(value), setValue, clear, inputRef };
}
