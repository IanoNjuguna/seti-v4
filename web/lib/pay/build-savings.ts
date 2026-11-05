import { encodeFunctionData, erc20Abi, parseUnits, type Address } from 'viem';
import type { Network } from '@/lib/network';
import { ASSET_DECIMALS, getTokenContractFor } from '@/lib/chain';
import type { TempoCall } from './build-transfer.types';
import { STABLECOIN_DEX_ADDRESS } from './build-swap';

/**
 * The vault's deposit entry point — the only function savings calls on it.
 *
 * `deposit(assetAmount, recipient, shareAmountMin)` returns the shares minted. The
 * floor matters: a vault that takes a fee at deposit can mint fewer shares than the
 * quote implied, and the customer signed for a minimum.
 */
const EARN_VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint256', name: 'assetAmount' },
      { type: 'address', name: 'recipient' },
      { type: 'uint256', name: 'shareAmountMin' },
    ],
    outputs: [{ type: 'uint256', name: 'shareAmount' }],
  },
] as const;

/** The vault's exit entry point — deliberately NOT the ERC-4626 signature. */
const EARN_VAULT_REDEEM_ABI = [
  {
    name: 'redeem',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint256', name: 'shares' },
      { type: 'address', name: 'recipient' },
      { type: 'uint256', name: 'assetAmountMin' },
    ],
    outputs: [{ type: 'uint256', name: 'assets' }],
  },
] as const;

/**
 * The STANDARD ERC-4626 entry points, for a vault that speaks it.
 *
 * The veda Earn vault takes a floor as its third argument on both calls; a Morpho vault
 * takes the ERC-4626 shape, where the third argument of `redeem` is the OWNER and there
 * is no floor anywhere. Two different contracts, so two different encodings, chosen by
 * the caller rather than guessed from the address.
 *
 * `shares` decimals differ too: veda's share token was 6dp, a Morpho vault's is 18dp,
 * which is why `shareDecimals` is a parameter and not `ASSET_DECIMALS.pathusd`.
 */
const ERC4626_DEPOSIT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint256', name: 'assets' },
      { type: 'address', name: 'receiver' },
    ],
    outputs: [{ type: 'uint256', name: 'shares' }],
  },
] as const;

const ERC4626_REDEEM_ABI = [
  {
    name: 'redeem',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint256', name: 'shares' },
      { type: 'address', name: 'receiver' },
      { type: 'address', name: 'owner' },
    ],
    outputs: [{ type: 'uint256', name: 'assets' }],
  },
] as const;

/** The asset a vault takes, and therefore the leg that may not need a swap at all. */
export type VaultAsset = 'ousd' | 'pathusd';

/** Which deposit/exit shape the vault exposes. */
export type VaultInterface = 'earn' | 'erc4626';

const DEX_SWAP_ABI = [
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
 * A deposit as THREE calls in ONE Tempo transaction.
 *
 *   1. swap OUSD → the vault's asset, with the quoted floor;
 *   2. approve the vault for exactly that amount — not unlimited, because an
 *      unlimited approval on a vault is a standing permission nobody asked for;
 *   3. deposit(amount, recipient, shareMin), shares minted to the customer.
 *
 * Atomic on purpose: a customer whose swap filled and whose deposit failed would be
 * holding the wrong stablecoin with no idea why. The batch completes or leaves them
 * exactly where they were.
 *
 * The recipient is a PARAMETER, never read from a global: shares minted to any other
 * address would be a position the customer cannot see or withdraw.
 *
 * Pure, like the other builders: this decides which contracts and which amounts get
 * signed, so the money rules are readable without a wallet.
 */
export function buildDepositCalls(input: {
  /** The OUSD leaving the spendable balance, in OUSD units. */
  amountIn: string;
  /** The pathUSD the swap must deliver, in pathUSD units — what gets deposited. */
  depositAmount: string;
  /** The floor on the swap, so a moving book cannot under-deliver. */
  minSwapOut: string;
  /** Which asset funds it. `pathusd` is the vault's own asset: no swap leg at all. */
  assetIn: 'ousd' | 'pathusd' | 'usdc.e' | 'usdt0';
  /** The floor on shares, so a vault fee cannot quietly shrink the position. */
  minShares: string;
  /** Where the shares are minted: the address that signs. */
  recipient: Address;
  vault: Address;
  network: Network;
  /** The asset the vault takes. Defaults to pathUSD, the veda Earn vault's asset. */
  vaultAsset?: VaultAsset;
  /** Which entry point the vault exposes. Defaults to the veda Earn shape. */
  vaultInterface?: VaultInterface;
  /** Share decimals, when the share token is not 6dp. A Morpho vault's is 18. */
  shareDecimals?: number;
}): TempoCall[] {
  const vaultAsset = input.vaultAsset ?? 'pathusd';
  const vaultInterface = input.vaultInterface ?? 'earn';
  const assetToken = getTokenContractFor(vaultAsset, input.network);

  const amountIn = parseUnits(input.amountIn, ASSET_DECIMALS.ousd);
  const depositAmount = parseUnits(input.depositAmount, ASSET_DECIMALS[vaultAsset]);
  const minSwapOut = parseUnits(input.minSwapOut, ASSET_DECIMALS[vaultAsset]);
  const minShares = parseUnits(input.minShares, input.shareDecimals ?? ASSET_DECIMALS.pathusd);

  if (amountIn <= BigInt(0) || depositAmount <= BigInt(0)) {
    throw new Error('Refusing to sign a deposit with no input or no amount.');
  }

  // A zero floor on either leg is an unbounded move: refuse it here rather than
  // trust the planner, exactly as the convert path does.
  if (minSwapOut <= BigInt(0) || minShares <= BigInt(0)) {
    throw new Error('Refusing to sign a deposit without a floor on the swap and the shares.');
  }

  /*
   * The swap leg exists only when the customer's asset is not the vault's. A customer
   * holding pathUSD deposits it directly — one fewer call, one fewer way to fail, and
   * no exposure to the book at all.
   */
  const swap: TempoCall[] =
    input.assetIn === vaultAsset
      ? []
      : [
          {
            to: STABLECOIN_DEX_ADDRESS,
            data: encodeFunctionData({
              abi: DEX_SWAP_ABI,
              functionName: 'swapExactAmountIn',
              args: [
                getTokenContractFor(input.assetIn, input.network),
                assetToken,
                amountIn,
                minSwapOut,
              ],
            }),
            value: BigInt(0),
          },
        ];

  const approve: TempoCall = {
    to: assetToken,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [input.vault, depositAmount],
    }),
    value: BigInt(0),
  };

  /*
   * The deposit legs, in the vault's own shape. An ERC-4626 vault takes `(assets,
   * receiver)` and computes the shares itself, so `minShares` is no longer a parameter
   * it accepts: it stays in the quote as the number the RECORDER asserts against the
   * receipt, which is where a floor can still refuse a shortfall.
   */
  const deposit: TempoCall = {
    to: input.vault,
    data:
      vaultInterface === 'erc4626'
        ? encodeFunctionData({
            abi: ERC4626_DEPOSIT_ABI,
            functionName: 'deposit',
            args: [depositAmount, input.recipient],
          })
        : encodeFunctionData({
            abi: EARN_VAULT_ABI,
            functionName: 'deposit',
            args: [depositAmount, input.recipient, minShares],
          }),
    value: BigInt(0),
  };

  return [...swap, approve, deposit];
}

/**
 * A withdrawal as THREE calls in ONE Tempo transaction:
 *
 *   1. approve the SHARE token for the vault — note the token: a withdrawal spends
 *      shares, not the vault's asset, and approving the wrong one fails on chain;
 *   2. redeem(shares, recipient, assetMin) — the vault pays its asset to the wallet,
 *      floored on the assets, because that is what `redeem` takes;
 *   3. swap the vault's asset back into OUSD, floored on the swap.
 *
 * Order matters and Tempo keeps it: the redeem has to pay out before the swap can
 * spend it, and the batch is atomic, so a bad fill anywhere leaves the position
 * exactly as it was rather than half-withdrawn.
 *
 * The recipient is the signing wallet — shares redeemed to any other address would
 * pay someone else.
 */
export function buildWithdrawCalls(input: {
  /** The shares being redeemed, in share units. */
  shares: string;
  /** The floor on what the vault pays out, in its asset units. */
  minAssets: string;
  /** The floor on the swap home, in OUSD units. */
  minSwapOut: string;
  /** Where the vault pays and the swap delivers: the address that signs. */
  recipient: Address;
  vault: Address;
  shareToken: Address;
  network: Network;
  /** The asset the vault pays out. Defaults to pathUSD, the veda Earn vault's asset. */
  vaultAsset?: VaultAsset;
  /** Which exit shape the vault exposes. Defaults to the veda Earn shape. */
  vaultInterface?: VaultInterface;
  /** Share decimals, when the share token is not 6dp. A Morpho vault's is 18. */
  shareDecimals?: number;
}): TempoCall[] {
  const vaultAsset = input.vaultAsset ?? 'pathusd';
  const vaultInterface = input.vaultInterface ?? 'earn';
  const assetToken = getTokenContractFor(vaultAsset, input.network);
  const ousd = getTokenContractFor('ousd', input.network);

  const shares = parseUnits(input.shares, input.shareDecimals ?? ASSET_DECIMALS.pathusd);
  const minAssets = parseUnits(input.minAssets, ASSET_DECIMALS[vaultAsset]);
  const minSwapOut = parseUnits(input.minSwapOut, ASSET_DECIMALS.ousd);

  if (shares <= BigInt(0)) {
    throw new Error('Refusing to sign a withdrawal of no shares.');
  }

  // Both floors are load-bearing: one bounds the vault's payout, the other bounds
  // the way home. Zero on either is an unbounded exit.
  if (minAssets <= BigInt(0) || minSwapOut <= BigInt(0)) {
    throw new Error('Refusing to sign a withdrawal without a floor on the payout and the swap.');
  }

  const approveShares: TempoCall = {
    to: input.shareToken,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [input.vault, shares],
    }),
    value: BigInt(0),
  };

  const redeem: TempoCall = {
    to: input.vault,
    data:
      vaultInterface === 'erc4626'
        ? encodeFunctionData({
            abi: ERC4626_REDEEM_ABI,
            functionName: 'redeem',
            args: [shares, input.recipient, input.recipient],
          })
        : encodeFunctionData({
            abi: EARN_VAULT_REDEEM_ABI,
            functionName: 'redeem',
            args: [shares, input.recipient, minAssets],
          }),
    value: BigInt(0),
  };

  /*
   * The swap spends the FLOOR, not the expected payout.
   *
   * A batch cannot use a value the chain only produces mid-execution, so the exact
   * assets the redeem pays are unknown when this call is built. Spending `minAssets`
   * is the only amount guaranteed to be in the wallet by then; the difference between
   * the floor and the actual payout stays in the vault's asset, which is spendable
   * and which the settlement pass sweeps into OUSD on the next app open. A little
   * dust beats a swap that tries to spend more than the redeem paid and reverts the
   * whole withdrawal.
   */
  /*
   * The swap home exists only when the vault's asset is not OUSD. A vault that pays OUSD
   * needs no way home at all: the redeem already delivered the spendable asset, so there
   * is no floor to spend, no book to cross and no dust left behind (#319).
   */
  const swapHome: TempoCall[] =
    vaultAsset === 'ousd'
      ? []
      : [
          {
            to: STABLECOIN_DEX_ADDRESS,
            data: encodeFunctionData({
              abi: DEX_SWAP_ABI,
              functionName: 'swapExactAmountIn',
              args: [assetToken, ousd, minAssets, minSwapOut],
            }),
            value: BigInt(0),
          },
        ];

  return [approveShares, redeem, ...swapHome];
}
