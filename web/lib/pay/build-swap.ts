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
 * The call settlement signs: ONE swap, with the server's floor in the calldata.
 *
 * Pure, so the decision about what gets signed is readable without a wallet. Both
 * figures come from the settlement plan — never from UI state, because there is no
 * UI: this runs while the customer has the app open and sees nothing.
 *
 * The floor travelling INTO the calldata is the whole safety argument. If the book
 * moves between the plan and the signature, the transaction reverts and the
 * customer keeps their money; the alternative — signing an unbounded swap in the
 * background — is exactly the kind of convenience that loses someone's balance.
 *
 * A zero floor is refused here rather than trusted from upstream: an unbounded
 * background swap must not be reachable by a bug in the planner.
 */
export function buildSettlementCall(input: {
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
