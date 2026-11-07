'use client';

import { SWAP_CARD_CLASS, SWAP_CARD_FOOTER_CLASS } from './SwapForm.constants';
import { SwapTokenPill } from './SwapTokenPill';
import type { SwapCardProps } from './SwapForm.types';

/**
 * One side of the pair: what the token is, what the figure is, and one quiet row under it.
 *
 * The card is the category's shape (#417): a token pill on the left, the figure filling the
 * rest of the row at display size, and a hairline row beneath that carries the supporting
 * fact, which is the balance on the pay side and what it is worth on the get side. Before
 * this, both sides were the same 56px form control with a label above it, so nothing on the
 * page said which side was the money and which was the shape it turns into.
 *
 * The caption (`You pay` / `You get`) is the card's heading and the pill's accessible name
 * at once: one sentence, said once, wired to the control it names.
 *
 * Both slots are nodes because the two sides look identical and behave differently: the pay
 * side's figure is an input, and the get side's is a figure the server sent.
 */
export function SwapCard({
  selectId,
  label,
  asset,
  options,
  busy,
  onChoose,
  figure,
  footer,
}: SwapCardProps) {
  return (
    <div className={SWAP_CARD_CLASS}>
      <p className="text-body-sm text-mute">{label}</p>

      <div className="mt-2 flex items-center justify-between gap-3">
        <SwapTokenPill
          id={selectId}
          label={label}
          value={asset}
          options={options}
          disabled={busy}
          onChoose={onChoose}
        />

        <div className="min-w-0 flex-1">{figure}</div>
      </div>

      <div className={SWAP_CARD_FOOTER_CLASS}>{footer}</div>
    </div>
  );
}
