import type { AppNavItem } from './AppNav.types';

/**
 * The three destinations.
 *
 * Pay is deliberately NOT here. Paying a merchant is a task, not a place — it starts
 * from the home screen's own card (scan a code, or type the name) and it is the flow the
 * app exists for, so a fifth way in from the tab bar only competed with the card that
 * explains it. The route still exists at `/app/pay`; it is just not a tab.
 *
 * Nothing here has a sub-route today, so every tab is an exact match. The child-path
 * rule in `useAppNav` stays anyway: the next destination that grows a detail screen
 * needs it, and a nav that forgets is the bug that rule exists to prevent.
 */
export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: '/app', label: 'Home', icon: 'home' },
  { href: '/app/activity', label: 'Activity', icon: 'activity' },
  { href: '/app/profile', label: 'Profile', icon: 'profile' },
];
