import type { DailyCount } from '@/lib/api/analytics';

/** Props of the home screen's streak map. */
export interface StreakMapProps {
  /** One entry per day, oldest first. Never empty: the caller checks. */
  daily: DailyCount[];
}
