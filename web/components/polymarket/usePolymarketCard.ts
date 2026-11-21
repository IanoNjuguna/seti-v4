'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/lib/auth';
import { ApiError } from '@/lib/api/client';
import {
  fetchPolymarketPositions,
  linkPolymarketAddress,
  unlinkPolymarketAddress,
} from '@/lib/api/polymarket';
import type { PolymarketLinkedView } from '@/lib/api/polymarket.types';
import { POLYMARKET_REFUSAL_COPY } from './PolymarketCard.constants';

/**
 * The Polymarket card's whole state machine (#599).
 *
 * Five states, and every one of them is a sentence rather than a missing figure:
 *
 *  - `loading` while the first read is in flight;
 *  - `signed-out`, which shows the ask instead of firing an account-scoped request;
 *  - `unlinked`, which is a link prompt, not an empty result;
 *  - `ready`, carrying the view — which may legitimately hold zero positions;
 *  - `failed`, carrying ONE sentence chosen by the refusal code.
 *
 * THE RULE THIS HOOK EXISTS TO ENFORCE: a failed read never becomes a zero. `view` is
 * absent in `failed` rather than zeroed, so no component can render `0` for a wallet whose
 * read timed out even by accident.
 *
 * THE SESSION STATES ARE DERIVED, NOT WRITTEN. An earlier version had the effect call
 * `setState` for the signed-out case, which React flags as a cascading render — and it is
 * also the wrong model: whether there is a session is a fact about the caller, not an
 * outcome of a request, so it is computed on render and the fetched result only ever
 * describes a signed-in caller. The one `setState` inside the effect's async body is the
 * request's own result, which is what an effect is for.
 */
export type PolymarketCardState =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'unlinked' }
  | { kind: 'ready'; view: PolymarketLinkedView }
  | { kind: 'failed'; message: string };

type FetchState = Exclude<PolymarketCardState, { kind: 'signed-out' }>;

function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.code && POLYMARKET_REFUSAL_COPY[error.code]) {
    return POLYMARKET_REFUSAL_COPY[error.code];
  }
  return POLYMARKET_REFUSAL_COPY['polymarket-unavailable'];
}

export function usePolymarketCard() {
  const session = useSession();
  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'loading' });
  const [address, setAddress] = useState('');
  const [pending, setPending] = useState(false);

  const load = useCallback(async (options?: { showLoading?: boolean }) => {
    if (options?.showLoading) setFetchState({ kind: 'loading' });
    try {
      const view = await fetchPolymarketPositions();
      setFetchState(view.linked ? { kind: 'ready', view } : { kind: 'unlinked' });
    } catch (error) {
      setFetchState({ kind: 'failed', message: messageFor(error) });
    }
  }, []);

  useEffect(() => {
    if (session.status !== 'signed-in') return;

    // The effect talks to the API itself rather than calling `load`, which is the idiom
    // the rest of the app's hooks use: the promise's own continuation is where state
    // lands, and `live` stops a response arriving after the caller signed out from
    // writing anything.
    let live = true;
    fetchPolymarketPositions()
      .then((view) => {
        if (!live) return;
        setFetchState(view.linked ? { kind: 'ready', view } : { kind: 'unlinked' });
      })
      .catch((error: unknown) => {
        if (live) setFetchState({ kind: 'failed', message: messageFor(error) });
      });

    return () => {
      live = false;
    };
  }, [session.status]);

  const link = useCallback(async () => {
    if (!address.trim() || pending) return;
    setPending(true);
    try {
      await linkPolymarketAddress(address);
      await load();
    } catch (error) {
      setFetchState({ kind: 'failed', message: messageFor(error) });
    } finally {
      setPending(false);
    }
  }, [address, pending, load]);

  const unlink = useCallback(async () => {
    setPending(true);
    try {
      await unlinkPolymarketAddress();
      setAddress('');
      setFetchState({ kind: 'unlinked' });
    } catch (error) {
      setFetchState({ kind: 'failed', message: messageFor(error) });
    } finally {
      setPending(false);
    }
  }, []);

  const reload = useCallback(() => load({ showLoading: true }), [load]);

  const state: PolymarketCardState =
    session.status === 'signed-in'
      ? fetchState
      : session.status === 'restoring'
        ? { kind: 'loading' }
        : { kind: 'signed-out' };

  return { state, address, setAddress, pending, link, unlink, reload };
}
