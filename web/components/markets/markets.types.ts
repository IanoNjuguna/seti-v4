import type { MarketCategory, MarketEvent, MarketSummary } from '@/lib/markets';

/**
 * Client-side shapes for the Markets surface.
 *
 * Everything data-shaped is imported from `lib/markets` rather than re-declared:
 * the API and the UI speak the same `MarketSummary` / `MarketEvent`, and a second
 * copy of those interfaces is how the two drift apart.
 */

export type MarketsFilterValue = MarketCategory | 'all';

export type MarketsListState =
  | { kind: 'loading' }
  | { kind: 'ready'; markets: MarketSummary[]; updatedAt: string }
  | { kind: 'error'; message: string };

export interface UseMarketsReturn {
  state: MarketsListState;
  retry: () => void;
}

export type MarketEventState =
  | { kind: 'loading' }
  | { kind: 'ready'; event: MarketEvent }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

export interface UseMarketEventReturn {
  state: MarketEventState;
  retry: () => void;
}

export interface MarketsFiltersProps {
  value: MarketsFilterValue;
  onChange: (value: MarketsFilterValue) => void;
}

export interface MarketCardProps {
  market: MarketSummary;
}

export interface ProbabilityBarProps {
  /** 0..1. A `null` price draws an empty track and no fill. */
  value: number | null;
  label: string;
}

export interface MarketsFailureProps {
  message: string;
  onRetry: () => void;
}

export interface MarketEventScreenProps {
  slug: string;
}

export interface MarketOutcomeRowProps {
  question: string;
  candidate: string | null;
  yes: number | null;
  spread: number | null;
}
