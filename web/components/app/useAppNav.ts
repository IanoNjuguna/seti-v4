'use client';

import { usePathname } from 'next/navigation';
import { APP_NAV_ITEMS } from './AppNav.constants';
import type { AppNavItem } from './AppNav.types';

export interface UseAppNavReturn {
  items: AppNavItem[];
  isActive: (href: string) => boolean;
}

/**
 * Active-tab logic lives here rather than in JSX.
 *
 * Exact match for a top-level destination, plus a child path for a destination that has
 * sub-routes, so a detail screen keeps its parent tab selected. The exception is `/app`
 * itself: a prefix match there marks Home active on every screen, which is the classic
 * nav bug this comment used to guard against, so Home stays exact.
 *
 * No destination has a sub-route right now. The rule is kept because the bug it prevents
 * is silent: a detail screen that lights no tab looks like a page outside the app.
 */
export function useAppNav(): UseAppNavReturn {
  const pathname = usePathname();

  return {
    items: APP_NAV_ITEMS,
    isActive: (href) =>
      pathname === href || (href !== '/app' && pathname.startsWith(`${href}/`)),
  };
}
