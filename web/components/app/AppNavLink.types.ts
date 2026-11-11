import type { AppNavItem } from './AppNav.types';

/**
 * One destination in the dock.
 *
 * There is no `layout` prop: the app has one nav at every width (#542), so there is no second
 * geometry for a caller to ask for.
 */
export interface AppNavLinkProps {
  item: AppNavItem;
  active: boolean;
}
