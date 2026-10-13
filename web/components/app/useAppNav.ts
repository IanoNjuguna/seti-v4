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
 * The comparison is exact rather than `startsWith`, so `/app` is not active
 * while you are on `/app/pay` — a prefix match marks Home active on every
 * screen, which is the classic nav bug.
 */
export function useAppNav(): UseAppNavReturn {
  const pathname = usePathname();

  return {
    items: APP_NAV_ITEMS,
    isActive: (href) => pathname === href,
  };
}
