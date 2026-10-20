'use client';

import { useMemo, useState } from 'react';
import type { MarketSummary } from '@/lib/markets';
import type { MarketsFilterValue } from './markets.types';

export interface UseMarketsFilterReturn {
  value: MarketsFilterValue;
  setValue: (next: MarketsFilterValue) => void;
  visible: MarketSummary[];
  isFiltered: boolean;
}

/**
 * Category filtering, done on the client.
 *
 * The alternative was a request per chip, which would put a cache miss and a venue
 * round trip behind a control the customer expects to be instant. The whole list is
 * already in memory and capped at 60 rows, so filtering is a memo and a chip is a
 * state change.
 */
export function useMarketsFilter(markets: MarketSummary[]): UseMarketsFilterReturn {
  const [value, setValue] = useState<MarketsFilterValue>('all');

  const visible = useMemo(
    () => (value === 'all' ? markets : markets.filter((market) => market.categories.includes(value))),
    [markets, value]
  );

  return { value, setValue, visible, isFiltered: value !== 'all' };
}
