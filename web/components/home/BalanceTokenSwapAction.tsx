'use client';

import { useState } from 'react';
import { Text } from '@/components/ui';
import { useConvertSwap } from '@/hooks/useConvertSwap';
import { SWAP_COPY } from '@/lib/pay/convert-swap.constants';
import { SWAP_ACTION_CLASS } from './BalanceTokenSwap.constants';
import { BalanceTokenSwapConfirm } from './BalanceTokenSwapConfirm';
import type { BalanceTokenSwapActionProps } from './BalanceTokenSwap.types';

/**
 * The two steps between a row and a signature.
 *
 * TWO STEPS ON PURPOSE, for a money path this small. The row action opens the figures
 * and only the confirm signs, so the "at least" figure is read before it can be
 * approved — and the confirm re-quotes at the moment of signing rather than trusting
 * the quote this row drew when it mounted.
 *
 * One figure on screen: `swap.quote` is the gate's quote until a re-quote replaces it.
 * A moved price therefore cannot leave the old line beside the new one, and the customer
 * is never confirming a number nobody priced.
 */
export function BalanceTokenSwapAction({ offer, onSwapped }: BalanceTokenSwapActionProps) {
  const [open, setOpen] = useState(false);
  const swap = useConvertSwap({ onSwapped });

  const close = () => {
    swap.reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        className={SWAP_ACTION_CLASS}
        onClick={() => setOpen(true)}
        aria-label={`${SWAP_COPY.action} this balance`}
      >
        <Text variant="micro" as="span" color="inverse">
          {SWAP_COPY.action}
        </Text>
      </button>
    );
  }

  const quote = swap.quote ?? offer;

  return (
    <BalanceTokenSwapConfirm
      quote={quote}
      busy={swap.busy}
      error={swap.error}
      done={swap.step === 'done'}
      onConfirm={() => void swap.confirm(quote)}
      onCancel={close}
    />
  );
}
