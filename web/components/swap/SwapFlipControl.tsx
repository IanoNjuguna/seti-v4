'use client';

import { Icon } from '@/components/ui/Icon';
import { SWAP_FLIP_CLASS, SWAP_FORM_COPY } from './SwapForm.constants';
import type { SwapFlipControlProps } from './SwapForm.types';

/**
 * The exchange, in one button: it turns the pair over.
 *
 * This is the element the page was missing (#417). Every swap surface in the reference set
 * puts a circular control between its two panels, because that is what makes two cards read
 * as one movement rather than as two settings that happen to sit together. Without it the
 * direction of the swap was implied by which picker held which token.
 *
 * The button is 40px, sits on the seam with `-my-5` from its wrapper, and wears the app's
 * own `swap` glyph, so the mark says what pressing it does.
 *
 * Disabled when the other side is not a balance this account holds: a swap is spent FROM a
 * balance, so turning the pair into a token we cannot spend would leave no source. The
 * button says so by being unavailable rather than by accepting the press and doing nothing.
 */
export function SwapFlipControl({ disabled, onFlip }: SwapFlipControlProps) {
  return (
    <div className="relative z-10 -my-5 flex justify-center">
      <button
        type="button"
        aria-label={SWAP_FORM_COPY.flipLabel}
        onClick={onFlip}
        disabled={disabled}
        className={SWAP_FLIP_CLASS}
      >
        <Icon name="swap" className="h-4 w-4" />
      </button>
    </div>
  );
}
