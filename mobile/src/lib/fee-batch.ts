import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem';
import { getTreasuryAddress } from './chain';

/**
 * Builds the two calls that route a merchant fee to Seti's treasury.
 *
 * Privy's `wallet_sendCalls` takes an array of `{to, data}` entries and
 * executes them atomically: either both transfers land or the whole batch
 * reverts. Under the hood it upgrades the user's EOA to a Kernel contract via
 * EIP-7702, so the wallet address is unchanged and no migration is needed.
 *
 * Why a batch rather than two sequential transfers: sequential transfers can
 * half-complete, leaving the merchant paid with no fee collected. Atomicity is
 * what makes the backend's two-leg reconciliation trustworthy — it can require
 * both legs because "one without the other" is not a reachable state.
 *
 * `sponsor` is deliberately NOT set. Tempo gas is paid in the same stablecoin
 * the customer is spending, so they fund the batch themselves and Seti takes on
 * no per-transaction cost. Adding a paymaster would introduce a bundler
 * dependency and a rate limit for no benefit.
 */

export interface FeeBatchLeg {
  to: Address;
  data: Hex;
}

export interface BuildFeeBatchInput {
  /** Token contract for the payment asset. */
  tokenContract: Address;
  /** Merchant receiving the principal. */
  merchantAddress: Address;
  /** Principal, in asset units (what the merchant keeps). */
  principalAmount: string;
  /** Fee, in asset units (what Seti keeps). */
  feeAmount: string;
  /** Token decimals, used to scale both amounts to base units. */
  decimals: number;
}

/**
 * Builds the merchant leg and the treasury fee leg, both as ERC-20 transfers.
 *
 * Throws rather than silently dropping the fee leg: if the treasury address is
 * missing or malformed, sending only the merchant leg would underpay Seti and
 * the backend would then refuse the payment anyway. Failing here surfaces the
 * misconfiguration before anything is signed.
 */
export function buildFeeBatchCalls(input: BuildFeeBatchInput): FeeBatchLeg[] {
  const treasury = getTreasuryAddress();

  const principal = BigInt(
    toBaseUnits(input.principalAmount, input.decimals)
  );
  const fee = BigInt(toBaseUnits(input.feeAmount, input.decimals));

  if (principal <= 0n) {
    throw new Error('Payment principal must be greater than zero.');
  }

  // A batch with a zero-value fee leg would revert on some tokens, and would
  // silently collect nothing even where it succeeds. The backend requires a real
  // fee leg, so refuse to build one.
  if (fee <= 0n) {
    throw new Error(
      'Fee amount is zero, so the batch would collect nothing. Check the fee schedule.'
    );
  }

  return [
    {
      to: input.merchantAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [input.merchantAddress, principal],
      }),
    },
    {
      to: treasury,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [treasury, fee],
      }),
    },
  ];
}

/**
 * Scales a decimal string to base units.
 *
 * Done with string arithmetic rather than `parseUnits` + float round-tripping so
 * a fee like 0.01999999 is not silently rounded before it reaches the chain.
 */
export function toBaseUnits(amount: string, decimals: number): string {
  const trimmed = amount.trim();

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Amount is not a valid decimal number: ${amount}`);
  }

  const [whole = '0', fraction = ''] = trimmed.split('.');
  const padded = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = `${whole}${padded}`.replace(/^0+(?=\d)/, '');

  return combined || '0';
}