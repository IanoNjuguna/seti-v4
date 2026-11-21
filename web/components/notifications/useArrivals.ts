'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchArrivals, type ArrivalsPage } from '@/lib/api/arrivals';

/**
 * The four states a list of arrivals can be in (#592).
 *
 * `failed` holds NO rows and NO written seen instant: a read that timed out must never look
 * like a quiet account, and it must never mark money as read that nobody saw. That is the
 * same rule the outcomes card follows, for the same reason — a zero is a claim.
 *
 * The read is written inline in the effect, the way `useClaims` writes its own: setState
 * arrives inside the promise callbacks, so the first render is already `loading` and nothing
 * is set synchronously to get there. `retry` bumps a nonce rather than refetching, so the
 * effect stays the single place a read starts.
 */
export type ArrivalsState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'empty' }
  | { kind: 'ready'; page: ArrivalsPage };

export function useArrivals() {
  const [state, setState] = useState<ArrivalsState>({ kind: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;

    fetchArrivals()
      .then((page) => {
        if (!live) return;
        setState(page.arrivals.length === 0 ? { kind: 'empty' } : { kind: 'ready', page });
      })
      .catch(() => {
        if (!live) return;
        setState({ kind: 'failed' });
      });

    return () => {
      live = false;
    };
  }, [nonce]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setNonce((value) => value + 1);
  }, []);

  return { state, retry };
}
