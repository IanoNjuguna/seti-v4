'use client';

import type { SupportedAsset } from '@/lib/chain';
import { cn } from '@/lib/cn';
import { Text } from '@/components/ui';
import { AssetSelect } from './AssetSelect';
import type { ConvertFieldProps } from './Convert.types';

/**
 * One side of the convert: the label, the figure, and the asset it is in.
 *
 * Not the `Input` primitive, and the difference is the asset chip inside the
 * well: `Input` is a labelled field with a full-width editable area, and a field
 * whose right edge is a `<select>` is a different control. What it borrows from
 * `Input` is the part that matters — the spec's `surface-soft` well, the
 * `rounded-md` shape, the 12px hairline, the cobalt focus ring — so the two read
 * as one family, and the label is a real `<label for>` rather than a placeholder.
 *
 * The value is `readOnly` on the receive side rather than disabled: a figure a
 * customer cannot edit but CAN select and copy is a figure, and a disabled input
 * greys out the one number on the page they came to read.
 *
 * `tabular` figures throughout (`font-mono`), because two amounts stacked on one
 * screen must line up at the decimal or the pair reads as two unrelated numbers.
 */
export function ConvertField({
  label,
  id,
  amount,
  onAmountChange,
  readOnly = false,
  placeholder,
  currencyPrefix,
  asset,
  assets,
  onAssetChange,
  selectLabel,
  hint,
}: ConvertFieldProps) {
  return (
    <div className="rounded-md border border-hairline-light bg-surface-soft px-4 py-3 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
      <label htmlFor={id} className="text-body-sm text-mute">
        {label}
      </label>

      <div className="mt-1 flex items-center gap-3">
        <Text as="span" variant="micro" color="secondary" className="font-mono">
          {currencyPrefix}
        </Text>

        <input
          id={id}
          value={amount}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={onAmountChange ? (event) => onAmountChange(event.target.value) : undefined}
          inputMode="decimal"
          autoComplete="off"
          className={cn(
            'h-9 min-w-0 flex-1 bg-transparent font-mono text-heading-sm font-medium text-ink outline-none',
            'placeholder:text-ash'
          )}
        />

        <AssetSelect
          label={selectLabel}
          id={`${id}-asset`}
          asset={asset}
          assets={assets}
          onChange={onAssetChange}
          disabled={readOnly}
        />
      </div>

      {hint ? (
        <Text variant="micro" color="secondary" as="p" className="mt-1">
          {hint}
        </Text>
      ) : null}
    </div>
  );
}
