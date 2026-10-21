import { post } from './client';

/**
 * The RECORD half of a conversion, from the app.
 *
 * The app never quotes a convert — settlement is priced server-side (see
 * `/transactions/settle/plan`), because there is no screen where a customer picks a
 * pair. What the app does is sign the swap the plan described and hand the receipt
 * back, which is what this call does.
 *
 * `POST /transactions/convert` verifies BOTH legs off the receipt before writing
 * anything: the input reaching the DEX and the output reaching the signing wallet,
 * at or above the floor that was signed. A hash alone records nothing.
 */

export interface RecordConvertInput {
  assetIn: string;
  assetOut: string;
  /** The input that was signed, in `assetIn` units. */
  amountIn: string;
  /** The floor that was signed, in `assetOut` units. */
  minAmountOut: string;
  txHash: string;
  /** The address the wallet signed with — the `from` of the transaction. */
  walletAddress: string;
  /** The frozen rate from the preview that produced the plan, when there was one. */
  quoteId?: string;
}

export interface RecordConvertResult {
  transaction: {
    id: string;
    status: string;
  };
}

export async function recordConvert(input: RecordConvertInput): Promise<RecordConvertResult> {
  return post<RecordConvertResult>('/transactions/convert', input);
}
