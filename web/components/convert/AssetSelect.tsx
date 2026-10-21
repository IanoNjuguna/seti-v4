'use client';

import type { SupportedAsset } from '@/lib/chain';
import { Text } from '@/components/ui';
import { convertSymbol } from './Convert.constants';

export interface AssetSelectProps {
  /** Visible-to-a-screen-reader name: the chip shows only the symbol. */
  label: string;
  id: string;
  asset: SupportedAsset;
  assets: readonly SupportedAsset[];
  onChange: (asset: SupportedAsset) => void;
  disabled?: boolean;
}

/**
 * The asset a row is about, as a native `select` styled to read as a chip.
 *
 * A native element rather than a custom menu on purpose: a convert has four
 * possible assets and three possible pairs, which is a list, and a `<select>`
 * brings keyboard navigation, type-ahead, and the platform's own picker on a
 * phone for free. A hand-built listbox would be a day of accessibility work to
 * arrive at something worse.
 *
 * The control shows the SYMBOL and wears the `heading-md` spec's mono figures one
 * step down, because every figure on this page is a stablecoin amount and the
 * symbol is part of that amount's identity, not a label beside it.
 *
 * The chevron is the set's own glyph, and the select is `appearance-none` so the
 * platform arrow does not appear next to it — two arrows on one control reads as
 * a rendering bug.
 */
export function AssetSelect({ label, id, asset, assets, onChange, disabled }: AssetSelectProps) {
  return (
    <div className="relative shrink-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={asset}
        disabled={disabled || assets.length < 2}
        onChange={(event) => onChange(event.target.value as SupportedAsset)}
        className="h-11 appearance-none rounded-full border border-hairline-light bg-canvas-light py-0 pl-4 pr-9 font-mono text-body-sm font-medium text-ink outline-none transition-colors hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {assets.map((option) => (
          <option key={option} value={option}>
            {convertSymbol(option)}
          </option>
        ))}
      </select>
      <Text
        as="span"
        variant="micro"
        color="secondary"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
      >
        ▾
      </Text>
    </div>
  );
}
