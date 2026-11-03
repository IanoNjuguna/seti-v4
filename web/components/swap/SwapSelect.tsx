'use client';

import { SWAP_SELECT_CLASS } from './SwapForm.constants';
import type { SwapSelectProps } from './SwapForm.types';

/**
 * One picker: the name a customer reads, and the choices the server named.
 *
 * A native `select` rather than a list of rows, because the choice is between two or
 * three things and the platform already has the control: it opens the system menu on a
 * phone, keeps the whole surface as the tap target (56px, the doc's `text-input` height)
 * and announces itself to a screen reader without a second control to keep in sync.
 *
 * The label is a real `label` bound by `id` — never a placeholder. The visual recipe is
 * `text-input`'s own (`SWAP_SELECT_CLASS`), so a picker and an amount field read as the
 * same object at the same size.
 *
 * `units` is printed beside the symbol on a SOURCE, because the choice is which balance
 * to spend and how much it holds is the reason to pick one. A target carries no units:
 * what the customer will hold there is not known until the quote says.
 */
export function SwapSelect({ id, label, value, options, disabled, onChoose }: SwapSelectProps) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="text-body-sm text-mute">
        {label}
      </label>

      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChoose(event.target.value)}
        className={SWAP_SELECT_CLASS}
      >
        {options.map((option) => (
          <option key={option.asset} value={option.asset}>
            {option.units === '' ? option.symbol : `${option.symbol}, ${option.units}`}
          </option>
        ))}
      </select>
    </div>
  );
}
