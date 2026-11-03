'use client';

import { Button } from '@/components/ui';
import { SWAP_FORM_COPY } from './SwapForm.constants';
import type { SwapSubmitProps } from './SwapForm.types';

/**
 * The one control that signs.
 *
 * `Swap now` is disabled until there is a quote for the figure and the pair on screen,
 * because the figure it signs is that quote's: a control that could be pressed while the
 * price is still being asked for is a control that signs the last one. While a signature
 * is in flight it shows the spinner AND is disabled, so a slow wallet is not a dead
 * button and cannot be pressed twice.
 *
 * Once the swap is recorded the sign control goes away and `Done` takes its place. Two
 * reasons: a finished swap has nothing left to sign, and the page is where the next swap
 * starts, which needs the figures cleared rather than re-drawn over a completed one.
 */
export function SwapSubmit({ busy, done, disabled, onReset }: SwapSubmitProps) {
  if (done) {
    return (
      <Button type="button" fullWidth onClick={onReset}>
        {SWAP_FORM_COPY.finish}
      </Button>
    );
  }

  return (
    <Button type="submit" fullWidth loading={busy} disabled={disabled}>
      {SWAP_FORM_COPY.confirm}
    </Button>
  );
}
