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
 * Exact match for a top-level destination, plus a child path for a destination that
 * has sub-routes — `/app/markets/<event>` must keep Markets selected. The exception
 * is `/app` itself: a prefix match there marks Home active on every screen, which is
 * the classic nav bug this comment used to guard against, so Home stays exact.
 */
export function useAppNav(): UseAppNavReturn {
  const pathname = usePathname();

  return {
    items: APP_NAV_ITEMS,
    isActive: (href) =>
      pathname === href || (href !== '/app' && pathname.startsWith(`${href}/`)),
  };
}
