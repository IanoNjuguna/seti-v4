import type { AnalyticsSummary, AnalyticsWindow } from '@/lib/api/analytics';
import type { AnalyticsMerchant } from '@/lib/api/analytics';

export interface HomeSummaryState {
  /**
   * The window Home summarises, or null until it lands. Null is also the answer
   * when the read failed: the row is absent rather than showing a figure nobody
   * measured.
   */
  window: AnalyticsWindow | null;
  /** The server's own ranking, capped. Empty means the section does not render. */
  merchants: AnalyticsMerchant[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export interface UseHomeSummaryReturn extends HomeSummaryState {
  /** The currency the analytics response is in, for the figures beside it. */
  currency: string;
}

export type { AnalyticsSummary };
