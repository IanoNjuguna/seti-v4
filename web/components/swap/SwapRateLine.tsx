'use client';

import { Text } from '@/components/ui';
import { swapAssetSymbol } from './swap-symbol.constants';
import { swapRateLine } from './SwapForm.constants';
import type { SwapRateLineProps } from './SwapForm.types';

/**
 * What one unit of the balance being spent buys, between the pair and the amount (#337).
 *
 * THE LINE THE PAGE WAS MISSING. Every swap surface worth looking at prints it (Uniswap,
 * Phantom, OKX, Trust, Binance all do, between their two panels), because otherwise the
 * page shows two quantities and never a price: a customer can see that 12 OUSD becomes
 * 11.99 pathUSD and cannot tell a 1bp spread from a 500bp one.
 *
 * The rate is the SERVER's figure, for this quote, computed from the same book answer that
 * produced `amountOut`. Nothing here divides one amount by another: `quote.rate` is
 * printed, and this component only puts the two symbols around it.
 *
 * It is one quiet line, in `secondary` ink at micro size, because it is a fact to check
 * rather than a figure to read: the amount in, the floor and the fee are the figures the
 * decision turns on, and a rate set at their weight would compete with them.
 */
export function SwapRateLine({ quote }: SwapRateLineProps) {
  const line = swapRateLine(
    swapAssetSymbol(quote.assetIn),
    quote.rate,
    swapAssetSymbol(quote.assetOut)
  );

  return (
    <Text variant="micro" as="p" color="secondary" tabular>
      {line}
    </Text>
  );
}
