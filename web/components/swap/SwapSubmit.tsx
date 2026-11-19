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
 * Once the swap is over the whole page becomes a result (#593): `SwapResult` when the
 * swap was recorded, `SwapNotRecorded` when it was signed but could not be written down.
 * Both replace this control rather than sitting under it, so a finished swap can never
 * offer the button that signs a second one.
 */
export function SwapSubmit({ busy, disabled }: SwapSubmitProps) {
  return (
    <Button type="submit" fullWidth loading={busy} disabled={disabled}>
      {SWAP_FORM_COPY.confirm}
    </Button>
  );
}
