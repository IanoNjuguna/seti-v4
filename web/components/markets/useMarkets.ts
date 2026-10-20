'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MarketListResponse } from '@/lib/markets';
import type { MarketsListState, UseMarketsReturn } from './markets.types';

/**
 * The list read.
 *
 * Every state transition happens inside an async callback or a handler, never
 * synchronously in the effect: `react-hooks/set-state-in-effect` is an error on
 * this surface, and a fetch that set `loading` on mount would be rejected even
 * though it looks correct. Loading therefore isn't stored — it IS the initial
 * state, and only an answer moves it.
 *
 * The response is read once and kept whole. A failed fetch keeps the venue's own
 * words (`Odds feed answered 503`) rather than flattening every cause into
 * "something went wrong", because that message is what the retry screen prints.
 */
export function useMarkets(): UseMarketsReturn {
  const [state, setState] = useState<MarketsListState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((count) => count + 1);
  }, []);

  useEffect(() => {
    let current = true;

    fetch('/api/markets', { credentials: 'omit' })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!current) return;

        if (!response.ok) {
          const message = readError(body) ?? `Odds feed answered ${response.status}`;
          setState({ kind: 'error', message });
          return;
        }

        const parsed = body as MarketListResponse;
        setState({ kind: 'ready', markets: parsed.markets, updatedAt: parsed.updatedAt });
      })
      .catch((error: unknown) => {
        if (!current) return;
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not reach the odds feed',
        });
      });

    return () => {
      current = false;
    };
  }, [attempt]);

  return { state, retry };
}

function readError(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const error = (body as { error?: unknown }).error;
  return typeof error === 'string' && error.length > 0 ? error : null;
}
