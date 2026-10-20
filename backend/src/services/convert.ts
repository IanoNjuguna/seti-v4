/**
 * Converting one stablecoin into another, priced by Tempo's own book.
 *
 * The venue is the enshrined Stablecoin DEX (`0xdec0…0000`): an onchain
 * orderbook, `quoteSwapExactAmountIn` to price and `swapExactAmountIn` to
 * execute, no allowance to grant, and the output settling to the wallet. Nothing
 * is deployed and nothing is custodied, which is why this is the smallest
 * possible step beyond a transfer.
 *
 * What this file does NOT do — deliberately, and the reason it is one file:
 *
 *  - It does not charge the 2% fee. That fee is attributed to a merchant payment
 *    and funded inside that payment's two-leg batch; a convert has no merchant,
 *    so `fees.ts` is not on this path at all. A fee here would be a different
 *    product with different copy, not a reuse.
 *  - It does not price anything itself. Every amount comes from the chain's own
 *    quote function; the only arithmetic done here is the tolerance applied to
 *    that quote to produce `minAmountOut`, and the conversion of the quote into
 *    the customer's currency at the FROZEN rate the preview hands back.
 *
 * The pairs are an ALLOWLIST rather than "whatever the chain accepts", because
 * the book is thin and unordered: a pair with no resting orders reverts
 * `InsufficientLiquidity`, and offering it would be offering a button that fails
 * after the customer has chosen an amount. Measured on mainnet 2026-10-20:
 * `usdc.e↔ousd` 0.9999/1.0000, `pathusd↔ousd` 1.0000/0.9999, `usdc.e↔pathusd`
 * 0.9998/1.0000, all filling to 100,000 units; `usdt0` reverts in both
 * directions at every size. On practice only `ousd↔pathusd` has a book (10 in,
 * 9.999 out). A pair that is not on the list is refused with its own code, so the
 * app can say "no market for this one" instead of showing a generic failure.
 */
import { formatUnits, parseUnits } from 'viem';
import { getFxQuote, resolveUserFiat } from './payments.js';
import { getUserBalance } from './balance.js';
import { issueQuote } from './quote.js';
import {
  STABLECOIN_DEX_ADDRESS,
  estimateNetworkFee,
  isListedOn,
  networkConfigFor,
  publicClientFor,
  servedNetwork,
} from './chain.js';
import { normalizeNetwork, type Network } from '../lib/network.js';
import { ASSET_DECIMALS, SUPPORTED_ASSETS, type SupportedAsset } from '../config/assets.js';

/**
 * The slippage bound, in basis points, applied to the chain's own quote.
 *
 * Half a percent is generous against a book that quotes 0.00–0.02% on the pairs
 * we offer, and it is the number the customer is shown as "at least". It is not
 * a price: the quote is the price, this is only how much of it we promise.
 */
export const CONVERT_TOLERANCE_BPS = 50;

/**
 * The pairs we will convert, per network, in the direction the book was measured.
 *
 * Order does not matter — {@link isAllowedPair} accepts either direction — but
 * the entries are the measured ones, not every permutation of four assets, and
 * `usdt0` appears in none of them because neither network has a book for it.
 */
export const CONVERT_PAIRS: Record<Network, ReadonlyArray<readonly [SupportedAsset, SupportedAsset]>> = {
  mainnet: [
    ['usdc.e', 'ousd'],
    ['pathusd', 'ousd'],
    ['usdc.e', 'pathusd'],
  ],
  testnet: [['ousd', 'pathusd']],
};

/** Why a convert cannot be quoted. Every one of these is a 422, not a 500. */
export type ConvertFailureCode =
  | 'convert-amount-invalid'
  | 'convert-unknown-asset'
  | 'convert-same-asset'
  | 'convert-pair-unavailable'
  | 'convert-no-liquidity'
  | 'convert-insufficient-balance';

export class ConvertRefusalError extends Error {
  readonly code: ConvertFailureCode;

  constructor(code: ConvertFailureCode, message: string) {
    super(message);
    this.name = 'ConvertRefusalError';
    this.code = code;
  }
}

/**
 * The DEX's two functions, as much of the ABI as this file reads.
 *
 * `uint128` on both sides is the protocol's own width; the client signs the same
 * signature, so a change here is a change to what gets executed.
 */
const DEX_ABI = [
  {
    type: 'function',
    name: 'quoteSwapExactAmountIn',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint128' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint128' }],
  },
] as const;

export function isAllowedPair(
  assetIn: SupportedAsset,
  assetOut: SupportedAsset,
  target: Network
): boolean {
  return CONVERT_PAIRS[target].some(
    ([a, b]) => (a === assetIn && b === assetOut) || (a === assetOut && b === assetIn)
  );
}

/** The asset `value` names, or a refusal — the app must switch on a code, not a string. */
function requireAsset(value: string, target: Network): SupportedAsset {
  const asset = value as SupportedAsset;
  if (!SUPPORTED_ASSETS.includes(asset)) {
    throw new ConvertRefusalError(
      'convert-unknown-asset',
      `Unknown asset "${value}". Supported: ${SUPPORTED_ASSETS.join(', ')}.`
    );
  }
  if (!isListedOn(asset, target)) {
    throw new ConvertRefusalError(
      'convert-unknown-asset',
      `${asset} is not on ${target}, so it cannot be converted here. ` +
        `Listed on ${target}: ${networkConfigFor(target).assets.join(', ')}.`
    );
  }
  return asset;
}

/**
 * Price one swap against the book, in the assets' own units.
 *
 * Chain-only and database-free on purpose: the check suite drives this directly,
 * so the pricing path is testable without a user, a wallet or a session.
 */
export async function quoteDexConvert(input: {
  assetIn: SupportedAsset;
  assetOut: SupportedAsset;
  amountIn: bigint;
  network?: Network;
}): Promise<{ amountOut: bigint; minAmountOut: bigint }> {
  const target = normalizeNetwork(input.network, servedNetwork);
  const tokens = networkConfigFor(target).tokens;
  const tokenIn = tokens[input.assetIn];
  const tokenOut = tokens[input.assetOut];

  if (!tokenIn || !tokenOut) {
    throw new ConvertRefusalError(
      'convert-unknown-asset',
      `This network does not list one of ${input.assetIn} / ${input.assetOut}.`
    );
  }

  let amountOut: bigint;
  try {
    amountOut = await publicClientFor(target).readContract({
      address: STABLECOIN_DEX_ADDRESS,
      abi: DEX_ABI,
      functionName: 'quoteSwapExactAmountIn',
      args: [tokenIn, tokenOut, input.amountIn],
    });
  } catch (error) {
    // The book's own refusal, surfaced as one of ours. A revert here means the
    // resting orders cannot fill this size, which is a refusal to quote rather
    // than a failure of the request.
    throw new ConvertRefusalError(
      'convert-no-liquidity',
      `No market for ${input.assetIn} → ${input.assetOut} at this size right now. ` +
        `Try a smaller amount. (${error instanceof Error ? error.message : String(error)})`
    );
  }

  if (amountOut <= 0n) {
    throw new ConvertRefusalError(
      'convert-no-liquidity',
      `${input.assetIn} → ${input.assetOut} quotes nothing for this amount.`
    );
  }

  // Integer arithmetic, so the bound can never be a rounding artefact of a
  // float: floor(amountOut * (10000 - bps) / 10000).
  const minAmountOut =
    (amountOut * BigInt(10_000 - CONVERT_TOLERANCE_BPS)) / BigInt(10_000);

  return { amountOut, minAmountOut };
}

export interface ConvertPreviewInput {
  userId: string;
  /** The network the account is acting on. Decides the tokens, the pair list and the book. */
  network?: Network;
  /** What the customer gives up, and what they want. Both named: a convert is a pair. */
  assetIn: string;
  assetOut: string;
  /**
   * The amount in the CUSTOMER'S currency, as every amount in this product is.
   * The asset leg is derived from it at the frozen rate, so the figure they typed
   * is the figure they see.
   */
  amountFiat: string;
}

export interface ConvertPreview {
  assetIn: SupportedAsset;
  assetOut: SupportedAsset;
  /** What leaves the wallet, in `assetIn`'s own units. */
  amountIn: string;
  /** What the book says arrives, in `assetOut`'s own units. */
  amountOut: string;
  /** The floor the wallet will accept, the quote less {@link CONVERT_TOLERANCE_BPS}. */
  minAmountOut: string;
  fiatAmountIn: string;
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
  /** Signed frozen rate. The record path writes the ledger from THIS rate. */
  quoteId: string;
}

/**
 * Quote a convert for one account.
 *
 * Order of operations matters: every refusal that needs no chain read happens
 * before the DEX is touched, so a request for a pair we do not offer costs
 * nothing and answers with the right code.
 */
export async function previewConvert(input: ConvertPreviewInput): Promise<ConvertPreview> {
  const target = normalizeNetwork(input.network, servedNetwork);

  const amountFiat = Number(input.amountFiat);
  if (!Number.isFinite(amountFiat) || amountFiat <= 0) {
    throw new ConvertRefusalError('convert-amount-invalid', 'Amount must be a positive number');
  }

  const assetIn = requireAsset(input.assetIn, target);
  const assetOut = requireAsset(input.assetOut, target);

  if (assetIn === assetOut) {
    throw new ConvertRefusalError(
      'convert-same-asset',
      `Both sides are ${assetIn}. Pick a different asset to convert into.`
    );
  }

  if (!isAllowedPair(assetIn, assetOut, target)) {
    throw new ConvertRefusalError(
      'convert-pair-unavailable',
      `No market for ${assetIn} → ${assetOut} on ${target}. ` +
        `Available here: ${CONVERT_PAIRS[target].map(([a, b]) => `${a}↔${b}`).join(', ')}.`
    );
  }

  const fiatCurrency = await resolveUserFiat(input.userId);
  const fx = await getFxQuote(fiatCurrency);
  const fiatPerUsd = fx.fiatPerUsd;

  // The customer's currency in, the asset out. `parseUnits` on the derived
  // figure rather than a float multiply on the amount, so the leg is exact at
  // the asset's own 6 decimals.
  const assetInAmount = fiatPerUsd > 0 ? amountFiat / fiatPerUsd : 0;
  const amountIn = parseUnits(assetInAmount.toFixed(ASSET_DECIMALS), ASSET_DECIMALS);

  const { amountOut, minAmountOut } = await quoteDexConvert({
    assetIn,
    assetOut,
    amountIn,
    network: target,
  });

  // Gas is the sender's, priced through the same measurement a send uses, and it
  // is read on the network this quote is for rather than the one this process
  // serves. `estimateNetworkFee` answers in the asset's own units; the customer's
  // figure is that amount at the same frozen rate, which is the one multiplication
  // on this path and it is a price conversion, not a quote.
  const estimate = await estimateNetworkFee(assetIn, target);
  const gasInAsset = parseUnits(estimate.feeAsset, ASSET_DECIMALS);
  const networkFeeFiat = (Number(estimate.feeAsset) * fiatPerUsd).toFixed(2);

  const { balance } = await getUserBalance(input.userId, assetIn, target);
  const hasEnoughBalance = parseUnits(balance, ASSET_DECIMALS) >= amountIn + gasInAsset;

  const amountOutUnits = Number(formatUnits(amountOut, ASSET_DECIMALS));

  const quoteId = issueQuote({
    userId: input.userId,
    fiatCurrency,
    fiatPerUsd,
    source: fx.source,
    asOf: fx.asOf,
    network: target,
  });

  return {
    assetIn,
    assetOut,
    amountIn: formatUnits(amountIn, ASSET_DECIMALS),
    amountOut: formatUnits(amountOut, ASSET_DECIMALS),
    minAmountOut: formatUnits(minAmountOut, ASSET_DECIMALS),
    fiatAmountIn: amountFiat.toFixed(2),
    fiatAmountOut: (amountOutUnits * fiatPerUsd).toFixed(2),
    fiatCurrency,
    fxRate: fx.fiatPerUsd.toString(),
    fxRateSource: fx.source,
    fxRateStale: fx.stale,
    hasEnoughBalance,
    networkFeeFiat,
    networkFeeSource: estimate.source,
    quoteId,
  };
}
