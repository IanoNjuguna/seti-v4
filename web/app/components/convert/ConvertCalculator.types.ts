import type { SupportedAsset } from '@/lib/chain';

/**
 * The converter's props (#586).
 *
 * Explicit interfaces for every component, as `modular-ui-authoring` requires: a props
 * object that grows a string at a time is how a component quietly becomes a page.
 */

/** Which way the reader is converting. */
export type ConvertDirection = 'toShillings' | 'toTokens';

export interface ConvertAsset {
  asset: SupportedAsset;
  symbol: string;
}

export interface ConvertFieldProps {
  /** What the field is for, printed above it. */
  label: string;
  value: string;
  /** Absent on the read-only side, which is the result. */
  onChange?: (value: string) => void;
  hint?: string;
  /** The asset picker, present only on the token side. */
  assets?: readonly ConvertAsset[];
  selectedAsset?: SupportedAsset;
  onSelectAsset?: (asset: SupportedAsset) => void;
}

export interface ConvertRateNoteProps {
  fiatPerUsd: number;
  source: string;
  publishedFor: string | null;
  stale: boolean;
}

export interface ConvertResultProps {
  label: string;
  /** Already formatted, unit included: this component prints, it does not calculate. */
  figures: string;
}
