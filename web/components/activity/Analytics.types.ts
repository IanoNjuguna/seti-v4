import type { DailyCount } from '@/lib/api/analytics';
import type {
  AnalyticsConsistency,
  AnalyticsSettlement,
  AnalyticsCustomers,
  AnalyticsSummary,
  AnalyticsWindow,
} from '@/lib/api/analytics';

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
  /** The account whose figures these are, for the one write this panel makes (#394). */
  userId: string | null;
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

/** Band 1: the period, the answer, and whether to trust it (#441). */
export interface AnalyticsSummaryBandProps {
  window: AnalyticsWindow;
  currency: string;
  windows: AnalyticsWindow[];
  days: number;
  onSelect: (days: number) => void;
  consistency: AnalyticsConsistency;
  settlement: AnalyticsSettlement;
}

/** The one figure the page is about. */
export interface AnalyticsHeroProps {
  value: string;
  days: number;
}

/** Money in and money out as the two segments of one bar, each labelled directly. */
export interface AnalyticsSplitBarProps {
  window: AnalyticsWindow;
  currency: string;
}

/** Consistency and settlement, demoted from panels to a sentence. */
export interface AnalyticsQualifierProps {
  consistency: AnalyticsConsistency;
  settlement: AnalyticsSettlement;
}

/** Band 2: the shape of the window. */
export interface AnalyticsSeriesBandProps {
  window: AnalyticsWindow;
  currency: string;
}

/** Band 3: one list slot, three questions. */
export interface AnalyticsDetailBandProps {
  window: AnalyticsWindow;
  customers: AnalyticsCustomers;
  currency: string;
}

/** The three lists band 3 switches between, in the order they are offered. */
export type AnalyticsDetailTab = 'merchants' | 'payers' | 'hours';

export interface AnalyticsBusyHoursProps {
  busyHours: AnalyticsWindow['busyHours'];
}

export interface AnalyticsDailyBarsProps {
  daily: DailyCount[];
}

export interface AnalyticsCustomersProps {
  customers: AnalyticsCustomers;
  currency: string;
}

export interface AnalyticsMerchantsProps {
  merchants: AnalyticsWindow['merchants'];
  currency: string;
}
