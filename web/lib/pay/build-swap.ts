import { encodeFunctionData, parseUnits, type Address } from 'viem';
import type { SupportedAsset } from '@/lib/chain';
import type { Network } from '@/lib/network';
import { ASSET_DECIMALS, getTokenContractFor } from '@/lib/chain';
import type { TempoCall } from './build-transfer.types';

/**
 * Tempo's enshrined Stablecoin DEX — the orderbook settlement trades against.
 *
 * `0xdec0…0000`, a precompile at a fixed address. Nothing is deployed by Seti,
 * nothing is custodied, no allowance is granted, and the output settles to the
 * wallet in the same transaction.
 */
export const STABLECOIN_DEX_ADDRESS: Address = '0xdec0000000000000000000000000000000000000';

/**
 * What the control on a balance row converts INTO.
 *
 * OUSD is the asset to hold, and that decision is made once: the backend's
 * `CONVERT_ROW_TARGET` names the same one for the same reason (see
 * `backend/src/services/convert.ts`, and `SETTLE_TARGET` in `settlement.ts`). The
 * route is general — any allowed pair, either direction — but a row offers one
 * action, not a pair picker.
 */
export const SWAP_TARGET_ASSET: SupportedAsset = 'ousd';

/**
 * The one function settlement calls: "spend exactly `amountIn`, take no less than
 * `minAmountOut`".
 *
 * Both amounts are `uint128`, which is Tempo's signature — copied exactly rather
 * than widened, because an `encodeFunctionData` against the wrong width produces
 * calldata the precompile rejects.
 */
const STABLECOIN_DEX_SWAP_ABI = [
  {
    name: 'swapExactAmountIn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'tokenIn' },
      { type: 'address', name: 'tokenOut' },
      { type: 'uint128', name: 'amountIn' },
      { type: 'uint128', name: 'minAmountOut' },
    ],
    outputs: [{ type: 'uint128', name: 'amountOut' }],
  },
] as const;

/**
 * The call a swap signs: ONE swap, with the server's floor in the calldata.
 *
 * Pure, so the decision about what gets signed is readable without a wallet. Both
 * figures come from the server's quote — never from UI state, and never recomputed
 * here from a balance: `amountIn` is what the quote priced and `minAmountOut` is the
 * floor the customer was shown, so a book that moves between the quote and the
 * signature reverts the transaction and the money stays in the wallet.
 *
 * The floor travelling INTO the calldata is the whole safety argument. Both callers
 * need it for their own reason: the settlement pass has no UI and could sign anything
 * if a planner mispriced, and the row control is a tap the customer has just made.
 *
 * A zero floor is refused here rather than trusted from upstream: an unbounded swap
 * must not be reachable by a bug in either caller.
 */
export function buildSwapCall(input: {
  assetIn: SupportedAsset;
  assetOut: SupportedAsset;
  amountIn: string;
  minAmountOut: string;
  network: Network;
}): TempoCall {
  const tokenIn = getTokenContractFor(input.assetIn, input.network);
  const tokenOut = getTokenContractFor(input.assetOut, input.network);

  if (tokenIn === tokenOut) {
    throw new Error(`Refusing to sign a swap between the same token (${input.assetIn}).`);
  }

  const amountIn = parseUnits(input.amountIn, ASSET_DECIMALS[input.assetIn]);
  const minAmountOut = parseUnits(input.minAmountOut, ASSET_DECIMALS[input.assetOut]);

  if (amountIn <= BigInt(0)) {
    throw new Error(`Refusing to sign a non-positive settlement: ${input.amountIn}`);
  }

  if (minAmountOut <= BigInt(0)) {
    throw new Error(`Refusing to sign an unbounded settlement: ${input.minAmountOut}`);
  }

  return {
    to: STABLECOIN_DEX_ADDRESS,
    data: encodeFunctionData({
      abi: STABLECOIN_DEX_SWAP_ABI,
      functionName: 'swapExactAmountIn',
      args: [tokenIn, tokenOut, amountIn, minAmountOut],
    }),
    value: BigInt(0),
  };
}

/**
 * The settlement pass's name for the same call.
 *
 * One builder, two callers, so a swap signed by the background pass and a swap signed
 * by the control on a row are the same bytes — the difference between them is only
 * who decided, and what they decided it for.
 */
export function buildSettlementCall(input: {
  assetIn: SupportedAsset;
  assetOut: SupportedAsset;
  amountIn: string;
  minAmountOut: string;
  network: Network;
}): TempoCall {
  return buildSwapCall(input);
}
