'use client';

import { Text } from '@/components/ui';
import { refusalMessageFor } from '@/lib/api/refusal.constants';
import { BalanceTokenSwapAction } from './BalanceTokenSwapAction';
import type { BalanceTokenSwapProps } from './BalanceTokenSwap.types';

/**
 * The swap control on one balance row, and what the row says when the book says no.
 *
 * THE ABSENCE IS THE FEATURE (#240), and it is the first decision in this file rather
 * than a `disabled` attribute three levels down. Whether a pair can be converted is a
 * fact about the book at this moment — measured pairs have appeared and disappeared
 * within a day — so a disabled button would promise a feature nobody measured, and
 * every customer would learn to press it once and be wrong.
 *
 * ## The one sentence a refused row says (#304)
 *
 * Two refusals are worth a line, and only two, because they are the two that name
 * something the customer can act on: `convert-no-liquidity` tells them to try a smaller
 * amount, and `convert-pair-unavailable` tells them this pair cannot be swapped at all.
 * The row used to say NOTHING in both cases, so a customer who had just learned from the
 * swap page that a balance could be moved into another found a row with no way in and no
 * explanation. The sentence is the code's own (`refusal.constants.ts`), it is not a
 * control, and it renders under the row's line where the swap control would have been.
 *
 * Every other refusal still draws nothing. A pair whose book cannot fill THIS size is not
 * news about the row — the customer never asked — and a read that failed must not block a
 * swap that would have worked. The decision still costs no request: it is made from the
 * gate's own answer before any hook runs.
 */
export function BalanceTokenSwap({ offer, code, onSwapped }: BalanceTokenSwapProps) {
  const sentence = refusalSentence(code);

  if (sentence !== null) {
    return (
      <Text variant="micro" as="p" color="inverse-muted" className="mt-1">
        {sentence}
      </Text>
    );
  }

  if (!offer) return null;

  return <BalanceTokenSwapAction offer={offer} onSwapped={onSwapped} />;
}

/** The two codes a row repeats, in the words `refusal.constants.ts` owns. */
const REFUSAL_CODES = ['convert-no-liquidity', 'convert-pair-unavailable'];

function refusalSentence(code: string | null | undefined): string | null {
  if (!code) return null;
  return REFUSAL_CODES.includes(code) ? refusalMessageFor(code) : null;
}
