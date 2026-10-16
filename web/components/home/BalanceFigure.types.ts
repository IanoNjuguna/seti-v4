import type { HomeDashboard } from '@/lib/api/home.types';

export interface BalanceFigureProps {
  /** `null` only for a signed-in account whose dashboard has not landed yet. */
  data: HomeDashboard | null;
}
