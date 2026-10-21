import type { ConvertPreview } from '@/lib/api';
import type { SupportedAsset } from '@/lib/chain';

/** Which call the page is in the middle of, or what it is showing. */
export type ConvertStatus = 'idle' | 'submitting' | 'done';

/** What the customer sees once the convert has landed. */
export interface ConvertResult {
  /** What ARRIVED, in the output asset's units — the ledger's own figure. */
  amountOut: string;
  assetOut: SupportedAsset;
  /** The same arrival in the customer's currency. */
  fiatAmountOut: string;
  fiatCurrency: string;
  txHash: string;
}

export interface UseConvertReturn {
  assetIn: SupportedAsset;
  assetOut: SupportedAsset;
  /** The assets this side can be changed to, on this chain's books. */
  sources: readonly SupportedAsset[];
  /** The assets `assetIn` can be converted into. Never empty. */
  targets: readonly SupportedAsset[];
  amountFiat: string;
  preview: ConvertPreview | null;
  status: ConvertStatus;
  result: ConvertResult | null;
  /** A sentence for the page to render, or null. */
  error: string | null;
  /** True while a quote is in flight, so the figure can show it is settling. */
  quoting: boolean;
  /** True when the button may be pressed. */
  canSubmit: boolean;
  setAmount: (amount: string) => void;
  setAssetIn: (asset: SupportedAsset) => void;
  setAssetOut: (asset: SupportedAsset) => void;
  /** Swap the two sides. The amount is cleared, because the pair changed. */
  flip: () => void;
  submit: () => void;
  /** Back to an empty form, with the last result cleared. */
  reset: () => void;
}
