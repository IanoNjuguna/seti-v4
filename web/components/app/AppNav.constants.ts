import type { AppNavItem } from './AppNav.types';
import { APP_HOME_PATH } from '@/lib/routes';

/**
 * The two destinations (#590).
 *
 * PROFILE IS NOT ONE OF THEM ANY MORE. It left the dock for the top bar, where the header
 * already keeps the account's state (`TopBarState` draws the handle and opens the profile), so
 * the dock was carrying a second door to a page the chrome already names. Two doors is the
 * thing the mobile shell rule warns about; the exception there is the header avatar, not a tab.
 *
 * TWO, NOT THREE, AND THAT IS THE OWNER'S CALL rather than a layout accident. The candidates
 * for the freed well were Save (a vault holding a promotional rate), Ask (an inbox the bell
 * will list), Swap, Send and Receive. Only Save passes the rule below without arguing: it is a
 * place, but its rate is a campaign with an end date, and a permanent tab is a claim of
 * permanence. The slab's wells are `flex-1`, so two spread evenly rather than sitting in a
 * third of it.
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
  { href: APP_HOME_PATH, label: 'Home', icon: 'home' },
  { href: '/app/activity', label: 'Activity', icon: 'activity' },
];
