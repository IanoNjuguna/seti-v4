import type { ConvertPreview } from '@/lib/api';
import type { SupportedAsset } from '@/lib/chain';
import type { Network } from '@/lib/network';
import { buildConvertCall } from './build-convert';
import { buildTempoTransaction } from './build-transfer';
import type { SendTempoTransaction } from './build-transfer.types';

export interface SignConvertInput {
  preview: ConvertPreview;
  assetIn: SupportedAsset;
  assetOut: SupportedAsset;
  /** The batch mechanism, from the Privy Tempo hook. */
  sendTempoTransaction: SendTempoTransaction;
  /** The network the ACCOUNT is acting on — decides the chain id and the tokens. */
  network: Network;
}

export interface SignConvertResult {
  txHash: string;
}

/**
 * Convert one stablecoin into another: ONE call, ONE signature, no approval.
 *
 * What this signs:
 *
 *   swapExactAmountIn(tokenIn, tokenOut, preview.amountIn, preview.minAmountOut)
 *
 * Both amounts are the server's. The floor is signed INTO the calldata rather
 * than checked afterwards, which is what makes the promise enforceable by the
 * chain instead of by our good intentions: if the book moves, the transaction
 * reverts and no stablecoin leaves the wallet.
 *
 * ## The fee token is the INPUT token
 *
 * A Tempo transaction pays gas in a TIP-20, and the preview priced gas in
 * `assetIn` — its `hasEnoughBalance` is "input plus gas, in the input token". So
 * the fee token must be the same asset, or the customer is told they can afford a
 * convert they cannot pay to send, and the swap reverts on gas.
 *
 * ## Not a batch of two
 *
 * There is no principal/fee split here, because a convert is not a payment and
 * collects no fee. One call is the whole transaction.
 */
export async function signConvert(input: SignConvertInput): Promise<SignConvertResult> {
  const { preview, assetIn, assetOut, sendTempoTransaction, network } = input;

  const call = buildConvertCall({
    assetIn,
    assetOut,
    amountIn: preview.amountIn,
    minAmountOut: preview.minAmountOut,
    network,
  });

  // `assetIn` is what makes `feeToken` the input token — see the note above.
  const request = buildTempoTransaction({ asset: assetIn, calls: [call], network });

  const txHash = await sendTempoTransaction(request);

  if (!txHash || typeof txHash !== 'string') {
    throw new Error('The wallet returned no transaction hash.');
  }

  return { txHash };
}
