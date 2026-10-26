'use client';

import { Button, Text } from '@/components/ui';
import { SWAP_COPY } from '@/lib/pay/convert-swap.constants';
import { swapAssetSymbol } from './BalanceTokenSwap.constants';
import { formatAssetUnits } from './home.format';
import type { BalanceTokenSwapConfirmProps } from './BalanceTokenSwap.types';

/**
 * The step between tapping Swap and a signature: two figures, then a decision.
 *
 * TWO LINES, AND BOTH ARE THE SERVER'S. "You get at least" is the FLOOR that gets
 * signed into the calldata, not the quote: the book may pay more and will not pay less,
 * and a sentence promising the quote would be a promise the chain is allowed to miss.
 * The fee is the network fee in the token being spent, because that is the unit it is
 * charged in — a figure printed in the customer's currency beside a token quantity
 * would be a second, unrelated-looking amount.
 *
 * NO COUNTDOWN, and no "quote expires in". The promise is that the figure you saw is the
 * figure recorded; a ticking clock turns it into a rate-lock to defend and rushes a
 * decision already made.
 *
 * The state line is ONE line and one tone at a time (`error` replaces it), and the buttons
 * disappear once the swap is done rather than inviting a second signature.
 */
export function BalanceTokenSwapConfirm({
  quote,
  busy,
  error,
  done,
  onConfirm,
  onCancel,
}: BalanceTokenSwapConfirmProps) {
  const atLeast = `${formatAssetUnits(quote.minAmountOut)} ${swapAssetSymbol(quote.assetOut)}`;
  const fee = `${formatAssetUnits(quote.networkFee)} ${swapAssetSymbol(quote.assetIn)}`;
  const sentence = error ?? (done ? SWAP_COPY.done : null);

  return (
    <div className="mt-2 border-t border-hairline-dark pt-3">
      <div className="flex items-baseline justify-between gap-4">
        <Text variant="micro" as="span" color="inverse-muted">
          {SWAP_COPY.getAtLeast}
        </Text>
        <Text variant="micro" as="span" tabular color="inverse" className="whitespace-nowrap">
          {atLeast}
        </Text>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-4">
        <Text variant="micro" as="span" color="inverse-muted">
          {SWAP_COPY.networkFee}
        </Text>
        <Text variant="micro" as="span" tabular color="inverse-muted" className="whitespace-nowrap">
          {fee}
        </Text>
      </div>

      {sentence !== null && (
        <Text
          variant="micro"
          as="p"
          role={error === null ? undefined : 'alert'}
          color={error === null ? 'inverse-muted' : 'alert'}
          className="mt-2"
        >
          {sentence}
        </Text>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!done && (
          <Button variant="on-dark" onClick={onConfirm} loading={busy}>
            {SWAP_COPY.confirm}
          </Button>
        )}
        <Button variant="outline-dark" onClick={onCancel} disabled={busy}>
          {SWAP_COPY.cancel}
        </Button>
      </div>
    </div>
  );
}
