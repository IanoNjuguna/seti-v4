import { get, post } from './client';

/**
 * A conversion, from the app's side.
 *
 * Two halves, and the split is the product:
 *
 *  - **A QUOTE route** (this file's `fetchConvertQuote`), authenticated, taking one
 *    allowed pair and an amount in the INPUT token's own units. It answers the live
 *    DEX quote, the floor (`CONVERT_TOLERANCE_BPS` under the quote), the network fee
 *    and the quote id the record path demands. Asking is a READ: nothing is signed
 *    and nothing is written, which is what lets a balance row ask whether a swap is
 *    even possible before it draws a control (#240).
 *  - **The RECORD half**, unchanged: `POST /transactions/convert` verifies BOTH legs
 *    off the receipt before writing anything — the input reaching the DEX and the
 *    output reaching the signing wallet, at or above the floor that was signed. A
 *    hash alone records nothing.
 */

/**
 * The figure a balance can spend on one swap.
 *
 * `'max'` is the server's own word for it, and not a convenience: gas is charged in
 * the input token on Tempo, so the spendable amount is the balance LESS the fee, and
 * signing the whole balance reverts on chain. The subtraction is a money rule, so it
 * happens on the server (`resolveConvertAmount`) rather than here.
 */
export const CONVERT_AMOUNT_MAX = 'max';

export interface ConvertQuoteInput {
  assetIn: string;
  assetOut: string;
  /** A decimal in `assetIn` units, or {@link CONVERT_AMOUNT_MAX}. */
  amountIn: string;
}

export interface ConvertQuote {
  network: string;
  assetIn: string;
  assetOut: string;
  /** What leaves the wallet, in `assetIn` units. */
  amountIn: string;
  /** What the book says arrives, in `assetOut` units. */
  amountOut: string;
  /** The floor to SIGN: the quote less `toleranceBps`. Never a figure to recompute. */
  minAmountOut: string;
  toleranceBps: number;
  /** Units of `assetOut` per 1 unit of `assetIn`, at this size. Display only. */
  rate: string;
  /** Gas for the swap, in `assetIn` units — the asset the sender pays it in. */
  networkFee: string;
  fiatCurrency: string;
  fiatAmountIn: string;
  fiatAmountOut: string;
  fxRate: string;
  fxRateSource: string;
  fxRateStale: boolean;
  networkFeeFiat: string;
  networkFeeSource: 'estimate' | 'reserve';
  /** The frozen rate. Hand it back with the hash; the record path refuses without it. */
  quoteId: string;
}

/**
 * Ask what a swap would pay.
 *
 * Refusals arrive as `ApiError` with a machine-readable code (`convert-no-liquidity`
 * when the book cannot fill this size, `convert-insufficient-balance` when the
 * balance cannot cover the amount plus gas, and so on), so a caller can hide a
 * control rather than show one that fails.
 */
export async function fetchConvertQuote(input: ConvertQuoteInput): Promise<ConvertQuote> {
  const { quote } = await post<{ quote: ConvertQuote }>('/transactions/convert/quote', input);
  return quote;
}

/**
 * One direction the book will fill, as the server spells it.
 *
 * `in` and `out` are the ledger's own labels (`ousd`, `pathusd`), the same strings a
 * balance row and a quote carry, so a pair can be matched against a balance without a
 * translation table in the client.
 */
export interface ConvertPair {
  in: string;
  out: string;
  /**
   * Whether the book will fill this direction right now (#496). Guidance, not a gate:
   * a dead direction still refuses at quote time with `convert-no-liquidity`.
   */
  live: boolean;
}

/**
 * What this account's network can convert, from the server.
 *
 * `targets` is every asset that appears on the right-hand side of some pair, and it is
 * carried rather than derived so the page shows the book's list and not a set this
 * client inferred from the pairs it happened to receive.
 */
export interface ConvertPairs {
  pairs: ConvertPair[];
  targets: string[];
}

/**
 * Ask which directions the book fills, for the caller's own network.
 *
 * A READ, like the quote: nothing is signed and nothing is written. It exists because a
 * page that offers a picker has to know what the picker may offer, and the answer is the
 * book's, measured now — the same reason a balance row asks before it draws a control
 * (#240). A refusal arrives as an `ApiError` and is shown as the sentence its code owns.
 */
export async function fetchConvertPairs(): Promise<ConvertPairs> {
  return get<ConvertPairs>('/transactions/convert/pairs');
}

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
