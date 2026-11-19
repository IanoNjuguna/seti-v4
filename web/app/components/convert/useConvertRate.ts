'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api/api.constants';

/**
 * The published rate, as this page reads it (#586).
 *
 * One request, to the same endpoint the app could use, and three honest states: loading,
 * the rate, or the rate could not be read. There is no fourth state where the page invents
 * a number, and no default figure held in the bundle: a converter that shows yesterday's
 * rate when the network fails is a converter that answers the wrong question confidently.
 *
 * The fetch is written the way `modular-ui-authoring` requires on this runtime: state is
 * written only from `.then`/`.catch` callbacks, never synchronously in the effect body,
 * because `react-hooks/set-state-in-effect` is an error under the React Compiler rules.
 */

export interface ConvertRate {
  /** Shillings per 1 USD, as the publisher issued it. */
  fiatPerUsd: number;
  /** Who published it: `cbk`, `open.er-api.com`, or `fallback`. */
  source: string;
  /** The publisher's own day, `YYYY-MM-DD`, when it publishes per day. */
  publishedFor: string | null;
  /** True when the figure is older than its publisher's cadence. */
  stale: boolean;
}

export type ConvertRateState =
  | { status: 'loading' }
  | { status: 'ready'; rate: ConvertRate }
  | { status: 'unavailable' };

interface RateResponse {
  rate?: {
    fiatPerUsd?: unknown;
    source?: unknown;
    publishedFor?: unknown;
    stale?: unknown;
  };
}

function readRate(body: RateResponse): ConvertRate | null {
  const rate = body.rate;
  if (!rate || typeof rate.fiatPerUsd !== 'number' || !Number.isFinite(rate.fiatPerUsd)) return null;
  if (rate.fiatPerUsd <= 0 || typeof rate.source !== 'string') return null;

  return {
    fiatPerUsd: rate.fiatPerUsd,
    source: rate.source,
    publishedFor: typeof rate.publishedFor === 'string' ? rate.publishedFor : null,
    stale: rate.stale === true,
  };
}

export function useConvertRate(): ConvertRateState {
  const [state, setState] = useState<ConvertRateState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    fetch(`${API_BASE_URL}/rates`, { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: RateResponse | null) => {
        if (!active) return;
        const rate = body ? readRate(body) : null;
        setState(rate ? { status: 'ready', rate } : { status: 'unavailable' });
      })
      .catch(() => {
        if (active) setState({ status: 'unavailable' });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
