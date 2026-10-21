import { get } from './client';

/**
 * What the customer's money did, over the two windows the server computes.
 *
 * The figures arrive as decimal STRINGS in the customer's own currency, not as
 * numbers: they are already formatted to the minor unit server-side, and parsing
 * them into floats here would reintroduce the rounding the server took care to
 * avoid. They are also reconciled there — `net` is the difference of the two
 * printed figures, so this endpoint cannot hand back three numbers that fail to
 * add up.
 *
 * `skipped` is a real count of rows the server could not read. It is carried so the
 * panel can say so rather than quietly under-reporting a total.
 */
export interface AnalyticsMerchant {
  name: string;
  count: number;
  total: string;
}

export interface AnalyticsWindow {
  days: number;
  in: string;
  out: string;
  net: string;
  count: number;
  skipped: number;
  merchants: AnalyticsMerchant[];
}

export interface AnalyticsSummary {
  currency: string;
  windows: AnalyticsWindow[];
}

/** Mirrors `backend/src/services/analytics.ts`. */
export function fetchAnalytics(userId: string): Promise<AnalyticsSummary> {
  return get<AnalyticsSummary>(`/users/${userId}/analytics`);
}
