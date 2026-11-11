'use client';

import { SWAP_CARD_CLASS, SWAP_CARD_FOOTER_CLASS } from './SwapForm.constants';
import { SwapTokenControl } from './SwapTokenControl';
import type { SwapCardProps } from './SwapForm.types';

/**
 * One side of the pair: what the token is, what the figure is, and one quiet row under it.
 *
 * The card is the category's shape (#417), read the way every reference draws it (#545): the
 * caption, then ONE row carrying the figure at the leading edge and the token control at the
 * trailing edge, then a hairline row carrying the supporting fact — the balance on the pay
 * side, what it is worth on the get side.
 *
 * The order is the swap. Before #545 the token sat on the LEFT and a right-aligned figure
 * filled the rest of a 728px row, which on a desk put the two things that belong together at
 * opposite ends of a very long line. A figure that starts at the card's edge and a token that
 * ends at it read as one line with two halves, and that is what makes "this becomes that"
 * legible without a caption to explain it.
 *
 * The caption (`You pay` / `You get`) is the card's heading and the token control's accessible
 * name at once: one sentence, said once, wired to the control it names.
 *
 * Both slots are nodes because the two sides look identical and behave differently: the pay
 * side's figure is an input, and the get side's is a figure the server sent.
 */
export function SwapCard({
  selectId,
  label,
  menuTitle,
  asset,
  options,
  busy,
  onChoose,
  figure,
  footer,
}: SwapCardProps) {
  return (
    <div className={SWAP_CARD_CLASS}>
      <p className="text-caption text-mute">{label}</p>

      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{figure}</div>

        <SwapTokenControl
          id={selectId}
          label={label}
          menuTitle={menuTitle}
          value={asset}
          options={options}
          disabled={busy}
          onChoose={onChoose}
        />
      </div>

      <div className={SWAP_CARD_FOOTER_CLASS}>{footer}</div>
    </div>
  );
}
