'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MarketEvent, MarketEventResponse } from '@/lib/markets';
import type { MarketEventState, UseMarketEventReturn } from './markets.types';

/**
 * One event, for the detail route.
 *
 * `404` is not an error: it means the event closed or the link is wrong, and the
 * page renders that as words. Everything else is a failure with the venue's own
 * message, so "odds feed answered 503" reaches the screen instead of a shrug.
 *
 * Same rule as the list: state moves only from async callbacks, never from the
 * effect body.
 */
export function useMarketEvent(slug: string): UseMarketEventReturn {
  const [state, setState] = useState<MarketEventState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((count) => count + 1);
  }, []);

  useEffect(() => {
    let current = true;

    fetch(`/api/markets/${encodeURIComponent(slug)}`, { credentials: 'omit' })
      .then(async (response) => {
        if (response.status === 404) {
          if (current) setState({ kind: 'missing' });
          return;
        }

        const body: unknown = await response.json();
        if (!current) return;

        if (!response.ok) {
          setState({ kind: 'error', message: readError(body) ?? `Odds feed answered ${response.status}` });
          return;
        }

        const parsed = body as MarketEventResponse;
        if (!parsed.event) {
          setState({ kind: 'missing' });
          return;
        }
        setState({ kind: 'ready', event: parsed.event satisfies MarketEvent });
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
  }, [slug, attempt]);

  return { state, retry };
}

function readError(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const error = (body as { error?: unknown }).error;
  return typeof error === 'string' && error.length > 0 ? error : null;
}
