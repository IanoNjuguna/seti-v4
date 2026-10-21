'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ACTIVITY_VIEW_PARAM,
  ACTIVITY_VIEWS,
  DEFAULT_ACTIVITY_VIEW,
  type ActivityView,
} from './ActivityView.constants';
import type { UseActivityViewReturn } from './ActivityView.types';

/**
 * Which view is selected, read from and written to the URL.
 *
 * The URL is the state, not a mirror of it: reload, a shared link and a link opened
 * from a statement all land on the same view, and the browser's own Back returns to
 * whatever page the reader came from rather than stepping back through tabs. That is
 * why the write is `replace` — switching a tab is looking at the same page
 * differently, not navigating.
 *
 * An unknown `?view=` value falls back to the default instead of rendering nothing:
 * a URL a customer typed, or one from an older build, should not produce an empty
 * screen. The default writes no parameter at all, so `/app/activity` and
 * `?view=transactions` are the same place with one canonical spelling.
 */
export function useActivityView(): UseActivityViewReturn {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const raw = params.get(ACTIVITY_VIEW_PARAM);
  const view: ActivityView =
    ACTIVITY_VIEWS.find((entry) => entry.id === raw)?.id ?? DEFAULT_ACTIVITY_VIEW;

  const setView = useCallback(
    (next: ActivityView) => {
      const search = new URLSearchParams(params.toString());

      if (next === DEFAULT_ACTIVITY_VIEW) {
        search.delete(ACTIVITY_VIEW_PARAM);
      } else {
        search.set(ACTIVITY_VIEW_PARAM, next);
      }

      const query = search.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  return { view, setView };
}
