'use client';

import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/Input';
import type { ConvertFieldProps } from './ConvertCalculator.types';

/**
 * One side of the converter: the amount, and the asset it is denominated in (#586).
 *
 * THE ASSET IS ON THE TOKEN SIDE ONLY, because shillings are one currency and a picker
 * offering "KES" as a choice beside OUSD would imply the reader is choosing a rate. The
 * picker is a native `select` styled from the system's tokens: it is a list of four, the
 * platform's own control is the accessible one, and a custom listbox would be a keyboard
 * contract this page does not need to own.
 *
 * THE INPUT IS THE PROJECT'S `Input` PRIMITIVE, not a raw `<input>`: it carries the
 * label/hint/aria wiring every other field in this repo uses, and a converter whose field
 * announces itself differently from the app's is a second field implementation to maintain.
 */
export function ConvertAmountField({
  label,
  value,
  onChange,
  hint,
  assets,
  selectedAsset,
  onSelectAsset,
}: ConvertFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value);

  return (
    <div className="flex flex-col gap-3">
      <Input
        label={label}
        hint={hint}
        value={value}
        onChange={handleChange}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        className="font-tabular"
      />

      {assets && selectedAsset && onSelectAsset ? (
        <label className="flex flex-col gap-2">
          <span className="text-caption text-mute">Asset</span>
          <select
            className="rounded-lg border border-hairline-light bg-canvas-light px-4 py-3 text-body-md text-ink"
            value={selectedAsset}
            onChange={(event) => onSelectAsset(event.target.value as typeof selectedAsset)}
          >
            {assets.map((option) => (
              <option key={option.asset} value={option.asset}>
                {option.symbol}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
