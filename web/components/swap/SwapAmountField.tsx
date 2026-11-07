'use client';

import { useEffect } from 'react';
import { Text } from '@/components/ui';
import { SWAP_FIGURE_CLASS, SWAP_FORM_COPY } from './SwapForm.constants';
import type { SwapAmountFieldProps } from './SwapForm.types';

/**
 * The amount, at the size the page is about.
 *
 * It used to be the third thing in a stack of four equal form controls, in a grey well,
 * smaller than everything around it (#417). On every swap screen that shares this job the
 * figure is the largest thing on the surface, because it is the only value the customer is
 * deciding. So the field moved into the pay card, to the right of the token, and takes the
 * figure size (`SWAP_FIGURE_CLASS`).
 *
 * It stays a real `<input>`: this is a web surface, the platform keyboard is the keypad, and
 * a control that looks like a number but is not editable would be a lie about the one thing
 * the customer must type.
 *
 * The field is never disabled for a refusal. A refusal that says the size is too big is an
 * instruction to type a smaller one, so the field keeps the cursor (`refocus`) and says what
 * is wrong in its own line: the entry checks are the field's, the server's verdict is the
 * state line's, and neither repeats the other.
 */
export function SwapAmountField({
  id,
  label,
  amount,
  error,
  busy,
  refocus,
  onAmount,
}: SwapAmountFieldProps) {
  // Focus is moved by id because the field is an input this component does not hold a ref to.
  useEffect(() => {
    if (!refocus) return;

    const field = document.getElementById(id);
    if (field instanceof HTMLInputElement) field.focus();
  }, [id, refocus]);

  const errorId = `${id}-error`;

  return (
    <>
      <input
        id={id}
        aria-label={label}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
        value={amount}
        onChange={(event) => onAmount(event.target.value)}
        inputMode="decimal"
        autoComplete="off"
        placeholder={SWAP_FORM_COPY.amountPlaceholder}
        disabled={busy}
        className={SWAP_FIGURE_CLASS}
      />

      {error !== null && (
        <Text variant="micro" as="p" color="alert" id={errorId} className="mt-1 text-right">
          {error}
        </Text>
      )}
    </>
  );
}
