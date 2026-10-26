'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { CONVERT_AMOUNT_MAX, fetchConvertQuote, type ConvertQuote } from '@/lib/api/convert';
import type { ConvertQuoteState, UseConvertQuoteInput } from './useConvertQuote.types';

/** Nothing was asked, so nothing is offered. */
const NOT_ASKED: ConvertQuoteState = { status: 'refused', quote: null, code: null };

/**
 * Ask the book whether this balance can be swapped at all.
 *
 * ## Why a request decides whether a control EXISTS
 *
 * The allowlist is a measurement with a date on it, and the book moves: USDT0 had no
 * market one lunchtime and quoted 1–2bps by the evening, and a pair that filled
 * 100,000 units on mainnet refused a fraction of that on practice. So the offer cannot
 * be read off a token list, and it must not be inferred from which assets exist — it
 * is the book's own answer, for THIS balance, asked now. A pair that cannot be quoted
 * therefore has nothing to press, and the row stays quiet (#240).
 *
 * ## Why `max` rather than the balance
 *
 * Gas is charged in the input token, so `max` is the balance less the network fee and
 * the subtraction is a money rule the server owns (`resolveConvertAmount`). Computed
 * here, it would be an amount derived from UI state, and the two would disagree on the
 * one figure that decides whether the swap reverts.
 *
 * ## State discipline
 *
 * Written only from the request's callbacks, guarded by `active` —
 * `react-hooks/set-state-in-effect` is an error in this package and it is right: a
 * synchronous setState in an effect cascades a render. A failure is `refused`, not an
 * error to show: the row has no control to put a sentence under, and a read that
 * failed must not block a swap that would have worked.
 */
export function useConvertQuote({ assetIn, assetOut, balance }: UseConvertQuoteInput): ConvertQuoteState {
  const [state, setState] = useState<ConvertQuoteState>({
    status: 'loading',
    quote: null,
    code: null,
  });

  // A row with nothing in it is not asked about: there is nothing to swap, and a chain
  // read per empty row would buy an answer already on screen. Derived rather than
  // written into state, because a `setState` in an effect body is an error here.
  const asked = balance !== '';

  useEffect(() => {
    if (!asked) return;

    let active = true;

    fetchConvertQuote({ assetIn, assetOut, amountIn: CONVERT_AMOUNT_MAX })
      .then((quote: ConvertQuote) => {
        if (!active) return;
        setState({ status: 'ready', quote, code: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: 'refused',
          quote: null,
          code: error instanceof ApiError ? (error.code ?? null) : null,
        });
      });

    return () => {
      active = false;
    };
    // `balance` is a trigger, not an input: see UseConvertQuoteInput.
  }, [assetIn, assetOut, balance, asked]);

  return asked ? state : NOT_ASKED;
}
