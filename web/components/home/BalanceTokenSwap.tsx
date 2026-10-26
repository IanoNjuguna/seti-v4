'use client';

import { BalanceTokenSwapAction } from './BalanceTokenSwapAction';
import type { BalanceTokenSwapProps } from './BalanceTokenSwap.types';

/**
 * The swap control on one balance row, and nothing at all when the book cannot fill it.
 *
 * THE ABSENCE IS THE FEATURE (#240), and it is the first line of this component rather
 * than a `disabled` attribute three levels down. Whether a pair can be converted is a
 * fact about the book at this moment — measured pairs have appeared and disappeared
 * within a day — so a disabled button would promise a feature nobody measured, and
 * every customer would learn to press it once and be wrong. A refusal draws nothing;
 * the row keeps its two lines.
 *
 * The early return is also why no hook runs on the refused path: there is no quote to
 * track, no wallet to ask for and no request to make, so a token whose book is empty
 * costs nothing at all.
 */
export function BalanceTokenSwap({ offer, onSwapped }: BalanceTokenSwapProps) {
  if (!offer) return null;

  return <BalanceTokenSwapAction offer={offer} onSwapped={onSwapped} />;
}
