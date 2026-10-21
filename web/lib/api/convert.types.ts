/**
 * Convert types, mirrored from `backend/src/services/convert.ts`.
 *
 * Kept as a copy rather than imported (the web package must not reach into the
 * backend's source). If these drift, the zod schemas in
 * `backend/src/routes/transactions.ts` are the contract — read them and reconcile
 * both sides.
 */

/**
 * What the book says a convert costs and pays, before anything is signed.
 *
 * Every figure is authoritative: the client signs `amountIn` and `minAmountOut`
 * and computes neither. The fiat figures exist because a person reading this page
 * thinks in their currency, and the token figures exist because the chain does.
 */
export interface ConvertPreview {
  assetIn: string;
  assetOut: string;
  /** What leaves the wallet, in `assetIn`'s own units — this is signed. */
  amountIn: string;
  /** What the book says arrives, in `assetOut`'s own units. */
  amountOut: string;
  /**
   * The floor the wallet will accept, in `assetOut`'s own units — signed too, and
   * the one figure the record path refuses to see under-delivered.
   */
  minAmountOut: string;
  /** What the customer typed, in their currency. */
  fiatAmountIn: string;
  /** The output converted to their currency at the quoted rate. */
  fiatAmountOut: string;
  fiatCurrency: string;
  /** Units of `fiatCurrency` per USD at the rate this preview priced with. */
  fxRate: string;
  fxRateSource: string;
  fxRateStale: boolean;
  /** True when the input plus the gas the sender funds is covered. */
  hasEnoughBalance: boolean;
  /** Gas for the swap, in the customer's currency. The sender funds it. */
  networkFeeFiat: string;
  networkFeeSource: 'estimate' | 'reserve';
  /**
   * Signed token carrying the exact rate this preview priced with. Pass it back in
   * `recordConvert`; the ledger is written from THIS rate, never a fresh read.
   */
  quoteId: string;
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
  /** The rate quote from the preview the customer confirmed. */
  quoteId?: string;
}

export interface RecordConvertResult {
  transaction: {
    id: string;
    status: string;
  };
}
