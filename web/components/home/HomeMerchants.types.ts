import type { AnalyticsMerchant } from '@/lib/api/analytics';

export interface HomeMerchantsProps {
  /** The window's own ranking, already capped by `paidRecently`. Empty renders nothing. */
  merchants: AnalyticsMerchant[];
  /** The currency the server printed each total in. */
  currency: string;
}
