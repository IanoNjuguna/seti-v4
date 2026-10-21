import type { AnalyticsMerchant, AnalyticsWindow } from '@/lib/api/analytics';

/** How many merchants Home has room for. Three is one glance, and `See all` is the rest. */
export const PAID_RECENTLY_LIMIT = 3;

/**
 * The window Home summarises: the longest the server computes.
 *
 * Asked for by SIZE rather than by index or by a hardcoded 30, so an endpoint that
 * later returns a 90-day window, or stops returning 30, cannot quietly put the
 * wrong period under the same label. Null when the server returned nothing, which
 * is what makes the row absent rather than showing a zero it did not measure.
 */
export function longestWindow(windows: AnalyticsWindow[]): AnalyticsWindow | null {
  return windows.reduce<AnalyticsWindow | null>(
    (longest, window) => (longest === null || window.days > longest.days ? window : longest),
    null
  );
}

/**
 * The merchants this window ranked, capped.
 *
 * The ORDER is the server's: it ranks by what the customer actually spent, and
 * re-sorting here (by name, by count, by anything) would be a second opinion about
 * the same data. Sliced, never filtered.
 */
export function paidRecently(
  window: AnalyticsWindow | null,
  limit = PAID_RECENTLY_LIMIT
): AnalyticsMerchant[] {
  return window === null ? [] : window.merchants.slice(0, limit);
}
