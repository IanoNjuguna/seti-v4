'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { refusalMessageFor } from '@/lib/api';
import { CONVERT_AMOUNT_MAX, fetchConvertPairs, type ConvertPair } from '@/lib/api/convert';
import type { AssetBalanceRow } from '@/lib/api/home.types';
import { useSession } from '@/lib/auth';
import { SWAP_COPY } from '@/lib/pay/convert-swap.constants';
import { swapAssetSymbol } from '@/components/swap/swap-symbol.constants';
import { formatAssetUnits } from '@/components/home/home.format';
import {
  SWAP_AMOUNT_DECIMALS,
  SWAP_AMOUNT_FIELD_ID,
  SWAP_FORM_COPY,
  SWAP_SOURCE_FIELD_ID,
  SWAP_TARGET_FIELD_ID,
} from '@/components/swap/SwapForm.constants';
import type {
  SwapAssetOption,
  SwapFormState,
  SwapStateLineModel,
} from '@/components/swap/SwapForm.types';
import { useConvertQuote } from './useConvertQuote';
import { useConvertSwap } from './useConvertSwap';
import { useSpendAssetRows } from './useSpendAssetRows';

/** What the book says it can fill, on the account's own network. */
type PairsState =
  | { status: 'loading' }
  | { status: 'ready'; pairs: ConvertPair[] }
  | { status: 'failed' };

const LOADING_PAIRS: PairsState = { status: 'loading' };

/** A stable empty list, so the derivations below do not re-run on every render. */
const NO_PAIRS: ConvertPair[] = [];

/** A decimal with at most the precision every supported asset carries. */
const AMOUNT_SHAPE = new RegExp(`^\\d*(\\.\\d{0,${SWAP_AMOUNT_DECIMALS}})?$`);

/**
 * What the field says about the figure typed into it, and what may be sent.
 *
 * Three checks, all of them about the ENTRY rather than about money: a figure that is
 * not a positive number, one finer than the asset can represent, and one larger than the
 * balance row it is spending. None of them decides a floor, a payout or a fee, and the
 * spendable maximum is never derived here — that is still asked with `max`, because gas
 * is charged in the input token and the subtraction is the server's (`resolveConvertAmount`).
 */
function readAmount(draft: string, units: string): { value: string; problem: string | null } {
  const trimmed = draft.trim();

  if (trimmed === '') return { value: '', problem: SWAP_FORM_COPY.amountEmpty };
  if (!AMOUNT_SHAPE.test(trimmed)) return { value: '', problem: SWAP_FORM_COPY.amountInvalid };

  const amount = Number(trimmed);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { value: '', problem: SWAP_FORM_COPY.amountEmpty };
  }

  if (amount > Number(units)) return { value: '', problem: SWAP_FORM_COPY.amountOverBalance };

  // A trailing point is a number being typed, and the server's decimal rule wants it
  // gone: what is sent is the figure on screen, spelled in a form the route accepts.
  return { value: trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed, problem: null };
}

/** The balances that can be a source of a swap. A row holding nothing has nothing to swap. */
function fundedRows(rows: readonly AssetBalanceRow[]): AssetBalanceRow[] {
  return rows.filter((row) => Number(row.amount) > 0);
}

/**
 * Whether the quote on hand answers the question on screen right now.
 *
 * A quote arrives a moment after the field changed, and until it does the figures beside
 * the field belong to the previous figure. `amountOut`, `minAmountOut` and `networkFee`
 * are promises, so they are only read off a quote that priced THIS amount for THIS pair.
 * `max` always matches: the field prints the server's own resolution of it.
 */
function answersNow(
  quote: { assetIn: string; assetOut: string; amountIn: string },
  pair: { assetIn: string; assetOut: string; asked: string }
): boolean {
  if (quote.assetIn !== pair.assetIn || quote.assetOut !== pair.assetOut) return false;
  if (pair.asked === CONVERT_AMOUNT_MAX) return true;
  return Number(quote.amountIn) === Number(pair.asked);
}

/**
 * `/app/swap`: which balance, which one to hold, how much, and then a signature.
 *
 * ## The figures are the server's, for the amount on screen
 *
 * A quote is asked for the amount the customer has on screen — `max` until they type,
 * then their own figure — and NOTHING here computes a floor, a payout or a fee. The one
 * arithmetic in this file is the entry check above, which compares a typed figure with
 * the balance row it spends and never with a quote.
 *
 * ## The default is the whole spendable balance, and it is the server's word
 *
 * `max` is sent, and the field then prints `quote.amountIn`: the amount the customer can
 * actually spend, with the gas the swap costs already subtracted by the server. Typing a
 * figure replaces it; `All` puts it back.
 *
 * ## Choices are derived, not written down
 *
 * The source is the first funded balance the book can fill, and the target is the first
 * pair out of the chosen source. Both fall back when a choice stops making sense, so a
 * stale pick cannot leave a source and a target that are the same asset, or a pair the
 * book no longer lists.
 */
export function useSwapForm(): SwapFormState {
  const session = useSession();
  const userId = session.user?.id ?? undefined;
  const { rows, loading: rowsLoading, unavailable: rowsUnavailable } = useSpendAssetRows(userId);

  const [pairs, setPairs] = useState<PairsState>(LOADING_PAIRS);
  const [sourceChoice, setSourceChoice] = useState<string | null>(null);
  const [targetChoice, setTargetChoice] = useState<string | null>(null);
  const [typed, setTyped] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!userId) return;

    let active = true;

    fetchConvertPairs()
      .then((answer) => {
        if (active) setPairs({ status: 'ready', pairs: answer.pairs });
      })
      .catch(() => {
        if (active) setPairs({ status: 'failed' });
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const convertPairs = pairs.status === 'ready' ? pairs.pairs : NO_PAIRS;

  const sources = useMemo<SwapAssetOption[]>(
    () =>
      fundedRows(rows).map((row) => ({
        asset: row.asset,
        symbol: row.symbol.trim() || swapAssetSymbol(row.asset),
        units: formatAssetUnits(row.amount),
      })),
    [rows]
  );

  const defaultSource = useMemo(() => {
    const fillable = sources.find((option) =>
      convertPairs.some((pair) => pair.in === option.asset)
    );
    return (fillable ?? sources[0])?.asset ?? '';
  }, [sources, convertPairs]);

  const assetIn =
    sourceChoice !== null && sources.some((option) => option.asset === sourceChoice)
      ? sourceChoice
      : defaultSource;

  const targetOptions = useMemo<SwapAssetOption[]>(() => {
    const options: SwapAssetOption[] = [];
    const seen = new Set<string>();

    for (const pair of convertPairs) {
      if (pair.in !== assetIn || pair.out === assetIn || seen.has(pair.out)) continue;
      seen.add(pair.out);
      options.push({ asset: pair.out, symbol: swapAssetSymbol(pair.out), units: '' });
    }

    return options;
  }, [convertPairs, assetIn]);

  const assetOut =
    targetChoice !== null && targetOptions.some((option) => option.asset === targetChoice)
      ? targetChoice
      : (targetOptions[0]?.asset ?? '');

  const sourceRow = rows.find((row) => row.asset === assetIn) ?? null;
  const asked = typed ? readAmount(draft, sourceRow?.amount ?? '0') : { value: CONVERT_AMOUNT_MAX, problem: null };
  const quotable = assetIn !== '' && assetOut !== '' && (typed ? asked.problem === null : true);

  const convert = useConvertQuote({
    assetIn,
    assetOut,
    // Empty means "do not ask": there is no pair, or no valid figure to price yet.
    balance: quotable && sourceRow ? sourceRow.amount : '',
    amount: asked.value,
  });

  const swap = useConvertSwap();
  const done = swap.step === 'done';

  // The quote the page may show, sign and promise: this pair, this amount.
  const quote =
    convert.status === 'ready' &&
    convert.quote !== null &&
    answersNow(convert.quote, { assetIn, assetOut, asked: asked.value })
      ? convert.quote
      : null;

  /**
   * The figure on screen, which a re-quote at signing time is allowed to replace.
   *
   * The confirm step re-asks the book before it signs, and a fresh answer that pays less
   * lands here as the swap's own quote with the `moved` sentence: one figure on screen,
   * never the old line beside the new one (#240, held to on this page too). It has to
   * answer the amount in the field, though, or it is an answer to a question nobody is
   * asking any more.
   */
  const shown =
    swap.quote !== null && answersNow(swap.quote, { assetIn, assetOut, asked: asked.value })
      ? swap.quote
      : quote;

  const stateLine = useMemo<SwapStateLineModel | null>(() => {
    if (rowsUnavailable) return { tone: 'alert', sentence: SWAP_FORM_COPY.balancesUnavailable };
    if (pairs.status === 'failed') return { tone: 'alert', sentence: SWAP_FORM_COPY.pairsUnavailable };
    if (sources.length === 0) return { tone: 'muted', sentence: SWAP_FORM_COPY.noBalances };
    if (assetOut === '') return { tone: 'muted', sentence: SWAP_FORM_COPY.nothingToHold };

    if (swap.error !== null) return { tone: 'alert', sentence: swap.error };
    if (done) return { tone: 'muted', sentence: SWAP_COPY.done };

    // The field carries its own sentence while the figure is not one to ask about.
    if (typed && asked.problem !== null) return null;
    if (!quotable) return null;

    if (convert.status === 'refused') {
      // A code with a sentence of its own is that sentence; a read that failed before it
      // produced a code is the swap path's own line for an unpriced quote.
      return {
        tone: 'alert',
        sentence: convert.code === null ? SWAP_COPY.notPriced : refusalMessageFor(convert.code),
      };
    }

    // Nothing quoted for THIS figure yet: the previous answer is not on screen either,
    // because a figure for money the customer is no longer swapping is not a figure.
    return { tone: 'muted', sentence: SWAP_FORM_COPY.checkingPrice };
  }, [
    rowsUnavailable,
    pairs.status,
    sources.length,
    assetOut,
    swap.error,
    done,
    typed,
    asked.problem,
    quotable,
    convert.status,
    convert.code,
  ]);

  const onAmount = useCallback((value: string) => {
    setTyped(true);
    setDraft(value);
  }, []);

  const onAll = useCallback(() => {
    setTyped(false);
    setDraft('');
  }, []);

  const onSource = useCallback((asset: string) => {
    setSourceChoice(asset);
    setTargetChoice(null);
  }, []);

  const onTarget = useCallback((asset: string) => {
    setTargetChoice(asset);
  }, []);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (shown === null) return;
      void swap.confirm(shown);
    },
    [shown, swap]
  );

  const loading = rowsLoading || pairs.status === 'loading';
  const ready = !loading && !rowsUnavailable && pairs.status === 'ready' && assetOut !== '';

  return {
    loading,
    ready,
    sourceOptions: sources,
    targetOptions,
    assetIn,
    assetOut,
    // A quote for THIS pair, or an empty field: the previous pair's figure is not the
    // amount that is about to be swapped.
    amount: typed ? draft : (shown?.amountIn ?? ''),
    amountError: typed ? asked.problem : null,
    quote: shown,
    stateLine,
    refocusAmount: convert.code === 'convert-no-liquidity',
    busy: swap.busy,
    done,
    canSubmit: shown !== null && !swap.busy && !done,
    onSource,
    onTarget,
    onAmount,
    onAll,
    onSubmit,
    onReset: swap.reset,
    amountFieldId: SWAP_AMOUNT_FIELD_ID,
    sourceFieldId: SWAP_SOURCE_FIELD_ID,
    targetFieldId: SWAP_TARGET_FIELD_ID,
  };
}
