import type { IconName } from '@/components/ui/icon-paths.constants';

export interface AppNavItem {
  href: string;
  label: string;
  /** Every destination carries a mark, so the nav is scannable by shape. */
  icon: IconName;
}

export interface AppNavProps {
  items: AppNavItem[];
  isActive: (href: string) => boolean;
}
