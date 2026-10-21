import type { AnalyticsWindow } from '@/lib/api/analytics';

export interface HomeSummaryProps {
  /** The longest window the server computed. Never null here: the page drops the row instead. */
  window: AnalyticsWindow;
  /** The currency the server printed the figures in. */
  currency: string;
}
