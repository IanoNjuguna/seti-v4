'use client';

import { createPortal } from 'react-dom';
import { ChoiceRow, Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { TokenMark } from '@/components/ui/TokenMark';
import {
  SWAP_FORM_COPY,
  SWAP_MENU_OVERLAY_CLASS,
  SWAP_MENU_PANEL_CLASS,
  SWAP_MENU_TITLE_ID,
} from './SwapForm.constants';
import { useSwapTokenDialog } from './useSwapTokenPicker';
import type { SwapAssetOption, SwapTokenPickerProps } from './SwapForm.types';

/**
 * The token list, as the app's own dialog (#545).
 *
 * It replaces a native `<select>`, whose menu is drawn by the operating system and whose
 * options could only be text: no mark, no second line, no way to say why a token the quote
 * will not fill is still listed. A picker that is the app's own surface can say all three.
 *
 * The rows are `ChoiceRow`, the control send and pay already use to choose a balance, so the
 * three flows cannot drift into three mental models of the same choice — and the row now takes
 * the token's mark (`mark`), which is what makes `USDC.e` and `USDT0` one glance apart.
 *
 * It is a portal for the same reason the receipt is: a dialog rendered inside the form is
 * clipped by any ancestor with `overflow` and can be given a form's submit semantics by the
 * keyboard. `role="dialog"`, `aria-modal`, a named heading and the focus contract from
 * `useSwapTokenDialog` make it a dialog rather than a panel over the page.
 */
export function SwapTokenPicker({
  title,
  value,
  options,
  onChoose,
  onClose,
}: SwapTokenPickerProps) {
  const { containerRef, onKeyDown } = useSwapTokenDialog(onClose);

  return createPortal(
    <div className={SWAP_MENU_OVERLAY_CLASS} onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={SWAP_MENU_TITLE_ID}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(event) => event.stopPropagation()}
        className={SWAP_MENU_PANEL_CLASS}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <Text variant="card-title" as="h2" id={SWAP_MENU_TITLE_ID}>
            {title}
          </Text>

          <button
            type="button"
            onClick={onClose}
            aria-label={SWAP_FORM_COPY.tokenMenuClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-mute transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="space-y-2">
          {options.map((option) => (
            <ChoiceRow
              key={option.asset}
              mark={<TokenMark asset={option.asset} size="lg" />}
              label={option.symbol}
              detail={rowDetail(option)}
              selected={option.asset === value}
              disabled={option.live === false}
              onSelect={() => onChoose(option.asset)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * What the row says under the symbol: what is held, or why it cannot be chosen.
 *
 * The balance is the paying side's own line, and an empty string (a token the customer does
 * not hold yet) leaves the row to its symbol alone rather than printing `Balance 0`. A row the
 * book cannot fill says so — the row stays in the list, because a token that vanishes from a
 * picker reads as a bug (#496).
 */
function rowDetail(option: SwapAssetOption): string | undefined {
  if (option.live === false) return SWAP_FORM_COPY.noMarket;
  if (option.units === '') return undefined;
  return `${SWAP_FORM_COPY.balanceLabel} ${option.units}`;
}
