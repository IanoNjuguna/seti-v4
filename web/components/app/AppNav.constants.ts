import type { AppNavItem } from './AppNav.types';
import { APP_HOME_PATH } from '@/lib/routes';
import { OUTCOMES_ICON } from '@/components/outcomes/Outcomes.constants';

/**
 * The dock's destinations (#590, #597).
 *
 * PROFILE IS NOT ONE OF THEM. It left the dock for the top bar, where the header
 * already keeps the account's state (`TopBarState` draws the handle and opens the profile), so
 * the dock was carrying a second door to a page the chrome already names. Two doors is the
 * thing the mobile shell rule warns about; the exception there is the header avatar, not a tab.
 *
 * TWO BECAME THREE. It was Home and Activity from #590, and every other place — save, swap,
 * ask, receive — is reached from a card on Home instead of a tab. That was not a layout
 * accident: a permanent tab is a claim of permanence, which is why Save was refused for the
 * freed well (its rate is a campaign with an end date). Outcomes is the first candidate that
 * passes the same rule rather than arguing with it — a place the account's own money is
 * measured in, with no campaign behind it — and the owner asked for it in the dock. Its page
 * says plainly that it is not open yet, so the claim the tab makes today is only that the place
 * exists; the tab and that route ship together because a link whose destination does not exist
 * is a 404 in production, not a TODO.
 *
 * PAY IS STILL NOT HERE. Paying a merchant is a task, not a place — it starts from the home
 * screen's own card (scan a code, or type the name) and it is the flow the app exists for, so a
 * tab only competed with the card that explains it. The route still exists at `/app/pay`; it is
 * just not a tab.
 *
 * Nothing here has a sub-route today, so every tab is an exact match. The child-path rule in
 * `useAppNav` stays anyway: the next destination that grows a detail screen needs it, and a nav
 * that forgets is the bug that rule exists to prevent.
 */
export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: APP_HOME_PATH, label: 'Home', icon: 'home' },
  { href: '/app/activity', label: 'Activity', icon: 'activity' },
  { href: '/app/outcomes', label: 'Outcomes', icon: OUTCOMES_ICON },
];
