'use client';

import { Icon } from '@/components/ui/Icon';
import { SWAP_PILL_CLASS } from './SwapForm.constants';
import type { SwapTokenPillProps } from './SwapForm.types';

/**
 * The token on one side of the swap: a symbol, a chevron and nothing else.
 *
 * A native `select` under a pill, for the reason `SwapSelect` gave: the choice is between
 * two or three things, the platform already ships the menu, and a screen reader announces
 * it without a second control to keep in sync. What changed is the SHAPE (#417). A 56px
 * input-height select with a label above it read as a settings field, so the pair could
 * not be read as "this becomes that"; the pill is a token, and the number beside it is the
 * figure.
 *
 * The balance used to be glued into the option text (`USDT0, 0.0045`), which made the
 * control read as a value rather than a token. It has its own line in the card now.
 *
 * The accessible name is the card's own caption (`You pay` / `You get`), passed through
 * `aria-label`: the visible label is the caption above the figure, so a second visible
 * label would set the same words twice.
 */
export function SwapTokenPill({ id, label, value, options, disabled, onChoose }: SwapTokenPillProps) {
  return (
    <div className="relative shrink-0">
      <select
        id={id}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChoose(event.target.value)}
        className={SWAP_PILL_CLASS}
      >
        {options.map((option) => (
          <option key={option.asset} value={option.asset}>
            {option.symbol}
          </option>
        ))}
      </select>

      {/* The chevron is decoration: the select opens on any point of the pill, so the mark
          must not swallow the tap, and `Icon` is `aria-hidden` already. */}
      <Icon
        name="chevronRight"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-mute"
      />
    </div>
  );
}
