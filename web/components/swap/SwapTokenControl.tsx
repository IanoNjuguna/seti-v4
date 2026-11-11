'use client';

import { Icon } from '@/components/ui/Icon';
import { TokenMark } from '@/components/ui/TokenMark';
import { SWAP_TOKEN_BUTTON_CLASS, SWAP_TOKEN_CHEVRON_CLASS } from './SwapForm.constants';
import { SwapTokenPicker } from './SwapTokenPicker';
import { useSwapTokenPicker } from './useSwapTokenPicker';
import type { SwapTokenControlProps } from './SwapForm.types';

/**
 * The token on one side: the control, and the list it opens (#545).
 *
 * A real `<button>` with `aria-haspopup="dialog"` and `aria-expanded`, drawing the token's
 * mark and symbol, and opening the app's dialog. What it replaced was a native `<select>`
 * with a mark drawn over it as a sibling — the select cannot hold an image, so it carried
 * `pl-10` to leave a hole for it — and the menu the OS drew was the only surface on the page
 * that did not look like this product.
 *
 * The accessible name is the card's caption (`You pay` / `You get`), because the caption above
 * it is the visible label and a second visible label would set the same words twice.
 *
 * The mark and the chevron are both decoration: the symbol already names the token and the
 * button already says what it does, so neither is announced.
 */
export function SwapTokenControl({
  id,
  label,
  menuTitle,
  value,
  options,
  disabled,
  onChoose,
}: SwapTokenControlProps) {
  const { open, show, hide } = useSwapTokenPicker();

  return (
    <>
      <button
        id={id}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={show}
        className={SWAP_TOKEN_BUTTON_CLASS}
      >
        <TokenMark asset={value} />
        <span>{symbolFor(options, value)}</span>
        <Icon name="chevronRight" className={`${SWAP_TOKEN_CHEVRON_CLASS} rotate-90`} />
      </button>

      {open && (
        <SwapTokenPicker
          title={menuTitle}
          value={value}
          options={options}
          onChoose={(asset) => {
            onChoose(asset);
            hide();
          }}
          onClose={hide}
        />
      )}
    </>
  );
}

/**
 * The symbol the control shows, read from the option list rather than from the asset label.
 *
 * A token name is a fact about a balance row (`USDC.e`, not `usdc.e`), so the trigger asks the
 * same list the dialog draws instead of spelling one itself. An empty list during a read
 * renders an empty control rather than a name this component invented.
 */
function symbolFor(options: readonly { asset: string; symbol: string }[], asset: string): string {
  return options.find((option) => option.asset === asset)?.symbol ?? '';
}
