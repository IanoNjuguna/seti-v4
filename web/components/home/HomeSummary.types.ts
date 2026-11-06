import type { AnalyticsSummary } from '@/lib/api/analytics';

export interface HomeSummaryProps {
  /** The map's series: a year of days, counted in the database. Never null here. */
  year: AnalyticsSummary['year'];
}
