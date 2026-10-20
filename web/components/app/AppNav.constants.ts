import type { AppNavItem } from './AppNav.types';

/**
 * The four destinations.
 *
 * Pay is deliberately NOT here. Paying a merchant is a task, not a place — it starts
 * from the home screen's own card (scan a code, or type the name) and it is the flow the
 * app exists for, so a fifth way in from the tab bar only competed with the card that
 * explains it. The route still exists at `/app/pay`; it is just not a tab.
 *
 * Markets sits second because it is the one destination that is not about money that
 * already moved. It is also the only destination with its own sub-route, which is why
 * `useAppNav` treats a child path as belonging to its parent tab.
 */
export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: '/app', label: 'Home', icon: 'home' },
  { href: '/app/markets', label: 'Markets', icon: 'markets' },
  { href: '/app/activity', label: 'Activity', icon: 'activity' },
  { href: '/app/profile', label: 'Profile', icon: 'profile' },
];
