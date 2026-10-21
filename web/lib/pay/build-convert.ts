import { encodeFunctionData, parseUnits, type Address } from 'viem';
import type { SupportedAsset } from '@/lib/chain';
import type { Network } from '@/lib/network';
import { ASSET_DECIMALS, getTokenContractFor } from '@/lib/chain';
import type { TempoCall } from './build-transfer.types';

/**
 * Tempo's enshrined Stablecoin DEX — the orderbook this convert trades against.
 *
 * `0xdec0…0000`, and it is a precompile at a fixed address rather than something
 * Seti deploys: nothing is custodied, no allowance is granted, and the output
 * settles to the wallet in the same transaction. The address is Tempo's, copied
 * verbatim from `viem`'s own `Addresses.stablecoinDex`.
 */
export const STABLECOIN_DEX_ADDRESS: Address = '0xdec0000000000000000000000000000000000000';

/**
 * The one function this app calls on the DEX, and the reason it is inlined.
 *
 * `swapExactAmountIn` is "sell": spend exactly `amountIn`, and take no less than
 * `minAmountOut`. Both amounts are `uint128`, which is narrower than a TIP-20
 * balance — `parseUnits` on a 6-decimal stablecoin cannot overflow it for any
 * amount a person will ever convert, but the wider signature is Tempo's and is
 * copied exactly.
 *
 * The ABI lives here rather than in `lib/chain` because nothing else in the app
 * talks to the DEX; when a second caller appears, it moves.
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
 * The call a convert signs: ONE swap against the book.
 *
 * Pure on purpose, like `buildTransfer`: this decides which contract, which pair
 * and which two amounts get signed, so it is the part of the convert path that
 * must be testable without a wallet.
 *
 * Both amounts come from the server's preview — `amountIn` is what was quoted and
 * `minAmountOut` is the floor the customer approved — never from UI state. The
 * floor travelling into the calldata is the whole point of a sell swap: if the
 * book moves before this lands, the chain reverts instead of filling it worse,
 * and the customer keeps their money.
 *
 * No approval call is batched ahead of this one. TIP-20 transfers out of a wallet
 * to a listed precompile are implicitly authorised on Tempo, so an `approve` leg
 * would be a second call that can only fail.
 */
export function buildConvertCall(input: {
  assetIn: SupportedAsset;
  assetOut: SupportedAsset;
  /** The input being spent, in `assetIn`'s own units, as a decimal string. */
  amountIn: string;
  /** The floor, in `assetOut`'s own units. Refused at zero: it is the only bound. */
  minAmountOut: string;
  /** The network the ACCOUNT is acting on — it decides both token contracts. */
  network: Network;
}): TempoCall {
  const tokenIn = getTokenContractFor(input.assetIn, input.network);
  const tokenOut = getTokenContractFor(input.assetOut, input.network);

  if (tokenIn === tokenOut) {
    throw new Error(
      `Refusing to sign a convert between the same token (${input.assetIn}): nothing would move.`
    );
  }

  // One decimals value per asset here (unlike the backend's single constant): a
  // TIP-20 transfer is denominated in its OWN token's units, so the input and the
  // floor are parsed with the decimals of the asset each belongs to.
  const amountIn = parseUnits(input.amountIn, ASSET_DECIMALS[input.assetIn]);
  const minAmountOut = parseUnits(input.minAmountOut, ASSET_DECIMALS[input.assetOut]);

  // `BigInt(0)`, not `0n`: this package targets below ES2020, where bigint
  // literals are a compile error.
  if (amountIn <= BigInt(0)) {
    throw new Error(`Refusing to sign a non-positive input: ${input.amountIn}`);
  }

  // A zero floor is not a loose convert, it is an UNBOUNDED one: the swap would
  // fill at whatever the book gives, including a price the customer never saw.
  // The server mints one from its own tolerance; refusing zero here means a bug
  // in that path cannot turn into a signed, unprotected swap.
  if (minAmountOut <= BigInt(0)) {
    throw new Error(`Refusing to sign a convert with no floor: ${input.minAmountOut}`);
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
