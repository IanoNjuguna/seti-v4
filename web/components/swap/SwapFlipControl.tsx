'use client';

import { IconButton } from '@/components/ui';
import { SWAP_FORM_COPY } from './SwapForm.constants';
import type { SwapFlipControlProps } from './SwapForm.types';

/**
 * The exchange, in one button: it turns the pair over.
 *
 * This is the element the page was missing (#417). Every swap surface in the reference set
 * puts a control between its two sides, because that is what makes them read as one movement
 * rather than as two settings that happen to sit together.
 *
 * It is `IconButton`, not a circle written here (#421). `design/revolut.md` allows exactly one
 * round shape — "avatars, status dots, spinners, round icon buttons" — and the app already
 * owns that primitive at 44px, with its `surface-soft` well, its hover step, its focus ring and
 * its disabled state. The hand-rolled circle was 40px, unfilled, bordered and shadowed: four
 * divergences from a control the product already had.
 *
 * Disabled when the other side is not a balance this account holds: a swap is spent FROM a
 * balance, so turning the pair into a token we cannot spend would leave no source. The button
 * says so by looking unavailable rather than by accepting the press and doing nothing.
 */
export function SwapFlipControl({ disabled, onFlip }: SwapFlipControlProps) {
  return (
    <IconButton
      name="swap"
      label={SWAP_FORM_COPY.flipLabel}
      onClick={onFlip}
      disabled={disabled}
    />
  );
}
