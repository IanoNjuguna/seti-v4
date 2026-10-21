import { post } from './client';
import type { ConvertPreview, RecordConvertInput, RecordConvertResult } from './convert.types';

/**
 * Converting one stablecoin into another: quote it, sign the quote, have the
 * server verify it from both legs.
 *
 * Two calls, not three, because a swap has no recipient to resolve: the pair IS
 * the request. `previewConvert` prices against the chain's own book and returns a
 * frozen rate; `recordConvert` re-reads the receipt before any row exists.
 *
 * The preview's refusals are 422 with a code: `convert-pair-unavailable` (no
 * market — `usdt0` on both networks), `convert-no-liquidity`,
 * `convert-insufficient-balance`, `convert-amount-invalid`.
 */
export async function previewConvert(input: {
  assetIn: string;
  assetOut: string;
  /** The amount the customer typed, in THEIR currency — as everywhere in this app. */
  amountFiat: string;
}): Promise<{ preview: ConvertPreview }> {
  return post<{ preview: ConvertPreview }>('/transactions/convert/preview', input);
}

export async function recordConvert(input: RecordConvertInput): Promise<RecordConvertResult> {
  return post<RecordConvertResult>('/transactions/convert', input);
}
