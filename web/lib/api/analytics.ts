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

export interface DailyCount {
  /** `YYYY-MM-DD`, UTC — the same calendar day the server buckets on. */
  date: string;
  /** Money movements that day. Zero is a fact: the day was inside the window and quiet. */
  count: number;
}

/** One half of the ledger as a window prints it (#396). */
export interface HalfFigure {
  count: number;
  total: string;
  average: string;
  median: string;
}

/**
 * The people on the other side (#396): a counterparty address on an inbound payment, counted over
 * the account's whole life rather than the selected window.
 */
export interface AnalyticsCustomers {
  count: number;
  repeat: number;
  lapsed: number;
  top: Array<{ address: string; count: number; total: string }>;
}

export interface AnalyticsWindow {
  days: number;
  in: string;
  out: string;
  net: string;
  count: number;
  skipped: number;
  merchants: AnalyticsMerchant[];
  /** What arrived from other people in this window. */
  received: HalfFigure;
  /** What left to merchants, with the fee attributed to it. */
  paidOut: HalfFigure & { fee: string };
  /** One entry per day in the window, oldest first, zero-filled (#369). */
  daily: DailyCount[];
}

/**
 * How steady the account is (#393): active days out of the last thirty, the busiest of them, and how
 * long since anything moved at all.
 */
export interface AnalyticsConsistency {
  activeDays: number;
  bestDay: { date: string; count: number } | null;
  /** Null when nothing has ever moved: there is no gap to report yet. */
  drySpellDays: number | null;
}

/** How the settlement is going (#395). Hours, from the row's own timestamps. */
export interface AnalyticsSettlement {
  pending: number;
  oldestPendingHours: number | null;
  settledCount: number;
  medianHours: number | null;
  worstHours: number | null;
}

export interface AnalyticsSummary {
  currency: string;
  customers: AnalyticsCustomers;
  consistency: AnalyticsConsistency;
  settlement: AnalyticsSettlement;
  windows: AnalyticsWindow[];
  /** A year of days for the streak map, counted in the database (#371). */
  year: { days: number; daily: DailyCount[]; payments: number };
}

/** Mirrors `backend/src/services/analytics.ts`. */
export function fetchAnalytics(userId: string): Promise<AnalyticsSummary> {
  return get<AnalyticsSummary>(`/users/${userId}/analytics`);
}
