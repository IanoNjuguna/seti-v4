import type { AnalyticsSummary, AnalyticsWindow } from '@/lib/api/analytics';

/**
 * The analytics read.
 *
 * `active` is why this exists as a hook rather than a bare fetch: the panel lives
 * inside a tab, so the read must not fire for a customer who never opens it, and it
 * must not fire AGAIN when they come back. The first visit fetches; the data stays.
 *
 * `loading` is derived (`active`, nothing yet, no failure) rather than stored, so a
 * fast answer cannot flash a skeleton.
 */
export interface UseAnalyticsInput {
  /** True once the analytics tab has been selected at least once. */
  active: boolean;
}

export interface UseAnalyticsReturn {
  data: AnalyticsSummary | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * One window out of the two the endpoint returns.
 *
 * `days` is asked for by name rather than by index: an endpoint that later returns
 * windows in another order, or stops returning one, must not silently show the
 * wrong period under the right label.
 */
export interface WindowPickerProps {
  windows: AnalyticsWindow[];
  selected: number;
  onSelect: (days: number) => void;
}

export interface AnalyticsFiguresProps {
  window: AnalyticsWindow;
  currency: string;
}

export interface AnalyticsMerchantsProps {
  merchants: AnalyticsWindow['merchants'];
  currency: string;
}
