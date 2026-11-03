'use client';

import { useEffect } from 'react';
import { Input } from '@/components/ui';
import { SWAP_FORM_COPY, SWAP_LINK_CLASS } from './SwapForm.constants';
import type { SwapAmountFieldProps } from './SwapForm.types';

/**
 * The amount, and the one control that fills it with the whole spendable balance.
 *
 * `All` does not put a balance in the field: it asks the server for `max` again, and the
 * field then shows the amount the server resolved. Gas is charged in the input token, so
 * the spendable figure is the balance LESS the fee, and that subtraction is a money rule
 * the server owns. Typing a figure is the other half: it replaces the resolved one, and
 * the quote follows it keystroke by keystroke.
 *
 * The field is never disabled for a refusal. A refusal that says the size is too big is
 * an instruction to type a smaller one, so the field keeps the cursor (`refocus`) and
 * says what is wrong in its own line: the entry checks are the field's, the server's
 * verdict is the state line's, and neither repeats the other.
 */
export function SwapAmountField({
  id,
  amount,
  error,
  busy,
  refocus,
  onAmount,
  onAll,
}: SwapAmountFieldProps) {
  // Focus is moved by id because the field's recipe is the shared `Input`, which takes
  // the props of an `input` and not a ref this component could own.
  useEffect(() => {
    if (!refocus) return;

    const field = document.getElementById(id);
    if (field instanceof HTMLInputElement) field.focus();
  }, [id, refocus]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-end">
        <button type="button" className={SWAP_LINK_CLASS} onClick={onAll} disabled={busy}>
          {SWAP_FORM_COPY.all}
        </button>
      </div>

      <Input
        id={id}
        label={SWAP_FORM_COPY.amountLabel}
        value={amount}
        onChange={(event) => onAmount(event.target.value)}
        inputMode="decimal"
        autoComplete="off"
        placeholder={SWAP_FORM_COPY.amountPlaceholder}
        error={error ?? undefined}
        disabled={busy}
      />
    </div>
  );
}
