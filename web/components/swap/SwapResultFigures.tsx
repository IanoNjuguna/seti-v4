'use client';

import { Text } from '@/components/ui';
import { formatAssetUnits } from '@/components/home/home.format';
import { formatFiat } from '@/lib/formatCurrency';
import { SWAP_RESULT_COPY } from '@/lib/pay/convert-swap.constants';
import { swapAssetSymbol } from './swap-symbol.constants';
import type { SwapResultFiguresProps } from './SwapForm.types';

/**
 * What the swap actually did, in three rows, from the quote that was SIGNED.
 *
 * Two figures and a fee, the way a receipt reads: what left, what arrived, what the
 * network charged for it. The fiat value sits under them in the app's own currency
 * format, because the customer thinks in shillings and the chain does not.
 *
 * Nothing here computes anything: `amountIn`, `amountOut` and `networkFee` are the
 * server's, from the quote the signature was built for. The symbols come from the
 * registry through `swapAssetSymbol`, so a token name on this card is a fact rather
 * than a string this app typed (#593).
 */
export function SwapResultFigures({ quote }: SwapResultFiguresProps) {
  const inSymbol = swapAssetSymbol(quote.assetIn);
  const outSymbol = swapAssetSymbol(quote.assetOut);

  return (
    <div className="space-y-2 rounded-md bg-surface-soft p-3 text-left">
      <div className="flex items-baseline justify-between gap-3">
        <Text variant="micro" color="secondary" as="span">
          {SWAP_RESULT_COPY.paid}
        </Text>
        <Text variant="body" tabular as="span">
          {formatAssetUnits(quote.amountIn)} {inSymbol}
        </Text>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <Text variant="micro" color="secondary" as="span">
          {SWAP_RESULT_COPY.got}
        </Text>
        {/* The money is the hero, one step up from the row above: after a swap the
            question is what arrived, and a fee line reads the same weight as it. */}
        <Text variant="balance-tight" tabular as="span">
          {formatAssetUnits(quote.amountOut)} {outSymbol}
        </Text>
      </div>

      <div className="flex items-baseline justify-between gap-3 border-t border-hairline-light pt-2">
        <Text variant="micro" color="secondary" as="span">
          {SWAP_RESULT_COPY.networkFee}
        </Text>
        <Text variant="micro" color="secondary" tabular as="span">
          {formatAssetUnits(quote.networkFee)} {inSymbol}
        </Text>
      </div>

      {/* Right-aligned with the figures above it: the fiat value is a value, and a value
          that hangs at the label's edge under a column of right-aligned figures reads as a
          fourth row somebody forgot to align. */}
      <Text variant="micro" color="secondary" tabular as="p" className="text-right">
        ≈ {formatFiat(Number(quote.fiatAmountOut), quote.fiatCurrency)}
      </Text>
    </div>
  );
}
