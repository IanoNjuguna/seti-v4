import type { AppNavItem } from './AppNav.types';

export interface AppNavLinkProps {
  item: AppNavItem;
  active: boolean;
  /** `bar` is the bottom tab bar, `rail` is the desktop side rail. */
  layout: 'bar' | 'rail';
}
