'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { SupportedAsset } from '@/lib/chain';
import { ConvertAmountField } from './ConvertAmountField';
import { ConvertRateNote } from './ConvertRateNote';
import { ConvertResult } from './ConvertResult';
import { ConvertUnavailable } from './ConvertUnavailable';
import {
  AMOUNT_HINT,
  AMOUNT_LABEL,
  CONVERT_ASSETS,
  DEFAULT_ASSET,
  DIRECTIONS,
  EMPTY_RESULT,
  RATE_LOADING,
  SWAP_LABEL,
  TOKEN_UNIT_FALLBACK,
} from './ConvertCalculator.constants';
import type { ConvertDirection } from './ConvertCalculator.types';
import { formatShillings, formatTokens, parseAmount, toShillings, toTokens } from './convert.math';
import { useConvertRate } from './useConvertRate';

/**
 * The converter (#586): one amount, a direction, and the published rate as the only input.
 *
 * THE RATE COMES FROM THE API, NEVER FROM THE BUNDLE. `useConvertRate` owns that read and
 * its three states; this component owns the arithmetic and nothing else. With no rate it
 * renders `ConvertUnavailable` instead of a number, which is the rule the whole page hangs
 * on: a converter that guesses is worse than one that says it cannot.
 *
 * A TYPED FIGURE THAT IS NOT AN AMOUNT PRINTS `—`. `parseAmount` refuses `1e5`, `12abc`,
 * `-5` and an empty field rather than coercing them, because a plausible-looking answer to
 * a typo is the failure mode of every converter on the internet.
 *
 * The swap control flips which side accepts input. It is a button rather than a toggle
 * because it is an action with a verb, and it is a full 44px target like every other
 * control here.
 */
export function ConvertCalculator() {
  const rateState = useConvertRate();
  const [amount, setAmount] = useState('25');
  const [direction, setDirection] = useState<ConvertDirection>('toShillings');
  const [asset, setAsset] = useState<SupportedAsset>(DEFAULT_ASSET);

  if (rateState.status === 'loading') {
    return <p className="text-body-md text-mute">{RATE_LOADING}</p>;
  }

  if (rateState.status === 'unavailable') {
    return <ConvertUnavailable />;
  }

  const { fiatPerUsd } = rateState.rate;
  const symbol = CONVERT_ASSETS.find((option) => option.asset === asset)?.symbol ?? TOKEN_UNIT_FALLBACK;
  const parsed = parseAmount(amount);

  const toShillingsMode = direction === 'toShillings';
  const figures =
    parsed === null
      ? EMPTY_RESULT
      : toShillingsMode
        ? formatShillings(toShillings(parsed, fiatPerUsd))
        : formatTokens(toTokens(parsed, fiatPerUsd), symbol);

  return (
    <div className="flex flex-col gap-8 rounded-lg bg-canvas-light p-6 text-ink md:p-8">
      <ConvertAmountField
        label={toShillingsMode ? `${AMOUNT_LABEL}, in ${symbol}` : `${AMOUNT_LABEL}, in shillings`}
        hint={AMOUNT_HINT}
        value={amount}
        onChange={setAmount}
        assets={toShillingsMode ? CONVERT_ASSETS : undefined}
        selectedAsset={toShillingsMode ? asset : undefined}
        onSelectAsset={toShillingsMode ? setAsset : undefined}
      />

      <ConvertResult
        label={toShillingsMode ? DIRECTIONS.toShillings.result : DIRECTIONS.toTokens.result}
        figures={figures}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setDirection(toShillingsMode ? 'toTokens' : 'toShillings')}
        >
          {SWAP_LABEL}
        </Button>
        <ConvertRateNote
          fiatPerUsd={fiatPerUsd}
          source={rateState.rate.source}
          publishedFor={rateState.rate.publishedFor}
          stale={rateState.rate.stale}
        />
      </div>
    </div>
  );
}
