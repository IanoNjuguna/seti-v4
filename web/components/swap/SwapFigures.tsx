'use client';

import { Text } from '@/components/ui';
import { swapAssetSymbol } from '@/components/home/BalanceTokenSwap.constants';
import { formatAssetUnits } from '@/components/home/home.format';
import { SWAP_FORM_COPY } from './SwapForm.constants';
import type { SwapFiguresProps } from './SwapForm.types';

/**
 * The two figures the swap promises, both read off the server's quote.
 *
 * "You get at least" is the FLOOR that reaches the calldata, not the quote: the book may
 * pay more and will not pay less, so the sentence names the least. The fee is the network
 * fee in the token being spent, because that is the unit it is charged in: a fee printed
 * in the customer's currency beside a token amount would read as a second, unrelated
 * number.
 *
 * Neither figure is computed here, and neither is derived from the balance: `minAmountOut`
 * and `networkFee` are printed exactly as the server sent them for the amount on screen
 * (`useSwapForm` only shows a quote that answers the figure in the field).
 */
export function SwapFigures({ quote }: SwapFiguresProps) {
  const atLeast = `${formatAssetUnits(quote.minAmountOut)} ${swapAssetSymbol(quote.assetOut)}`;
  const fee = `${formatAssetUnits(quote.networkFee)} ${swapAssetSymbol(quote.assetIn)}`;

  return (
    <div className="flex flex-col gap-1 border-t border-hairline-light pt-3">
      <div className="flex items-baseline justify-between gap-4">
        <Text variant="micro" as="span" color="secondary">
          {SWAP_FORM_COPY.getAtLeast}
        </Text>
        <Text variant="micro" as="span" tabular color="primary" className="whitespace-nowrap">
          {atLeast}
        </Text>
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <Text variant="micro" as="span" color="secondary">
          {SWAP_FORM_COPY.networkFee}
        </Text>
        <Text variant="micro" as="span" tabular color="secondary" className="whitespace-nowrap">
          {fee}
        </Text>
      </div>
    </div>
  );
}
