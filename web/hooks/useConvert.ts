'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  previewConvert,
  recordConvert,
  refusalMessage,
  type ConvertPreview,
} from '@/lib/api';
import type { SupportedAsset } from '@/lib/chain';
import { CHAIN_ID_FOR } from '@/lib/chain';
import { convertSourcesFor, convertTargetsFor } from '@/lib/pay/convert-pairs';
import { signConvert } from '@/lib/pay/sign-convert';
import { quoteArrived } from '@/lib/feedback';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { useTempoSender } from '@/hooks/useTempoSender';
import { useAppNetwork } from '@/components/app/useAppNetwork';
import type { ConvertResult, ConvertStatus, UseConvertReturn } from './useConvert.types';

/** How long to wait after the last keystroke before quoting the book. */
const PREVIEW_DEBOUNCE_MS = 400;

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return refusalMessage(error, 'convert');
  return 'Could not complete that convert. Nothing was converted.';
}

/**
 * The convert page's whole state: the pair, the amount, the quote on it, and the
 * one commit.
 *
 * ## The displayed quote is display-only
 *
 * A debounced preview prices what the customer is typing, but `submit` fetches
 * its OWN preview and signs that one. A swap's price is a fact about the book at
 * a moment, and the book does not owe us a fill at a figure that has been sitting
 * on screen: quoting again immediately before signing is what makes the signed
 * floor honest instead of optimistic.
 *
 * ## Nothing is read from captured state after an `await`
 *
 * The fee is signed, the floor is signed, and the recorded row carries the same
 * figures the signature did. Reading `state.preview` after an await returns the
 * PREVIOUS render's value — the bug `usePayMerchant` was ported to avoid — so
 * every figure below travels in a local.
 */
export function useConvert(): UseConvertReturn {
  const { network } = useAppNetwork();
  const chainId = CHAIN_ID_FOR[network];
  const { getSigningWallet } = useEmbeddedWallet();
  const { sendTempoTransaction } = useTempoSender();

  // The DEFAULT pair a fresh page shows. Both are only defaults: what the page
  // renders is the derived pair below, which cannot name an asset this chain's
  // books do not trade.
  const [defaultIn, setDefaultIn] = useState<SupportedAsset>('usdc.e');
  const [defaultOut, setDefaultOut] = useState<SupportedAsset>('ousd');
  const [amountFiat, setAmountFiat] = useState('');
  const [preview, setPreview] = useState<ConvertPreview | null>(null);
  const [status, setStatus] = useState<ConvertStatus>('idle');
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  /** The arrival pulse fires once per flow, on the first quote — as on pay. */
  const quoted = useRef(false);

  /**
   * The pair, DERIVED rather than stored.
   *
   * Practice has one book (`ousd ↔ pathusd`) and mainnet has three, so a pair
   * chosen on one network may not exist on the other — and the defaults above are
   * mainnet's. Falling back in a render, instead of correcting it in an effect,
   * means the page never renders a pair the books cannot fill and never renders a
   * frame with an asset the picker does not offer; it also keeps
   * `react-hooks/set-state-in-effect` satisfied for the honest reason rather than
   * with a suppression.
   */
  const sources = convertSourcesFor(chainId);
  const assetIn = sources.includes(defaultIn) ? defaultIn : (sources[0] ?? defaultIn);

  const targets = convertTargetsFor(chainId, assetIn);
  const assetOut = targets.includes(defaultOut) ? defaultOut : (targets[0] ?? defaultOut);

  const setAmount = useCallback((amount: string) => {
    setAmountFiat(amount);
    setError(null);
  }, []);

  const setAssetIn = useCallback((asset: SupportedAsset) => {
    setDefaultIn(asset);
    setPreview(null);
    setError(null);
  }, []);

  const setAssetOut = useCallback((asset: SupportedAsset) => {
    setDefaultOut(asset);
    setPreview(null);
    setError(null);
  }, []);

  const flip = useCallback(() => {
    setDefaultIn(assetOut);
    setDefaultOut(assetIn);
    setPreview(null);
    setAmountFiat('');
    setError(null);
  }, [assetIn, assetOut]);

  /**
   * Quote while the amount is being typed.
   *
   * State is written only in the timer's callbacks, never in the effect body:
   * `react-hooks/set-state-in-effect` is an error in this package, and it is
   * right — a synchronous setState here cascades a render per keystroke.
   */
  useEffect(() => {
    const amount = Number(amountFiat);
    if (!Number.isFinite(amount) || amount <= 0) return;

    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      // Written in the timer's callback, never in the effect body: a synchronous
      // setState there cascades a render per keystroke, and this package treats
      // `react-hooks/set-state-in-effect` as an error.
      setQuoting(true);
      previewConvert({ assetIn, assetOut, amountFiat })
        .then(({ preview: next }) => {
          if (!active) return;
          if (!quoted.current) {
            quoted.current = true;
            quoteArrived();
          }
          setPreview(next);
          setError(null);
        })
        .catch((caught: unknown) => {
          if (!active) return;
          quoted.current = false;
          setPreview(null);
          setError(toMessage(caught));
        })
        .finally(() => {
          if (active) setQuoting(false);
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [amountFiat, assetIn, assetOut]);

  /**
   * Quote once more, sign that, then hand the receipt to the server.
   *
   * The three steps are deliberately sequential and each one is abandoned on
   * failure: a fresh quote that fails means nothing is signed, a signature that
   * fails means nothing is recorded, and a record that fails leaves the money
   * moved but unrecorded — which is why the error says so rather than pretending
   * the convert did not happen.
   */
  const submit = useCallback(() => {
    if (status === 'submitting') return;
    if (!Number.isFinite(Number(amountFiat)) || Number(amountFiat) <= 0) return;

    setStatus('submitting');
    setError(null);

    void (async () => {
      try {
        const { preview: fresh } = await previewConvert({ assetIn, assetOut, amountFiat });

        if (!fresh.hasEnoughBalance) {
          setError('Your balance does not cover this convert and its gas.');
          setStatus('idle');
          return;
        }

        const wallet = await getSigningWallet();
        const { txHash } = await signConvert({
          preview: fresh,
          assetIn,
          assetOut,
          sendTempoTransaction,
          network,
        });

        await recordConvert({
          assetIn,
          assetOut,
          amountIn: fresh.amountIn,
          minAmountOut: fresh.minAmountOut,
          txHash,
          walletAddress: wallet.address,
          quoteId: fresh.quoteId,
        });

        setResult({
          amountOut: fresh.amountOut,
          assetOut,
          fiatAmountOut: fresh.fiatAmountOut,
          fiatCurrency: fresh.fiatCurrency,
          txHash,
        });
        setStatus('done');
      } catch (caught: unknown) {
        setError(toMessage(caught));
        setStatus('idle');
      }
    })();
  }, [amountFiat, assetIn, assetOut, getSigningWallet, network, sendTempoTransaction, status]);

  const canSubmit =
    status !== 'submitting' &&
    preview !== null &&
    preview.hasEnoughBalance &&
    Number(amountFiat) > 0;

  /**
   * Back to an empty form after a convert.
   *
   * A reset rather than a reload: the pair is still the one they chose, and
   * reloading the route throws away the network read and the quote machinery to
   * arrive at the same place.
   */
  const reset = useCallback(() => {
    setResult(null);
    setStatus('idle');
    setAmountFiat('');
    setPreview(null);
    setError(null);
    quoted.current = false;
  }, []);

  return {
    assetIn,
    assetOut,
    sources,
    targets,
    amountFiat,
    preview,
    status,
    result,
    error,
    quoting,
    canSubmit,
    setAmount,
    setAssetIn,
    setAssetOut,
    flip,
    submit,
    reset,
  };
}
