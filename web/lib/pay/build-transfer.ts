import { encodeFunctionData, erc20Abi, parseUnits, type Address } from 'viem';
import type { TempoCall, TempoTransactionRequest, TokenTransfer } from './build-transfer.types';
import type { SupportedAsset } from '@/lib/chain';
import type { Network } from '@/lib/network';
import { ASSET_DECIMALS, chainConfigFor, getTokenContractFor } from '@/lib/chain';

/** Tempo's native transaction type (EIP-2718 envelope, serialized as `0x76`). */
export const TEMPO_TRANSACTION_TYPE = 118;

/**
 * Build the single TIP-20 transfer for `inside-transfer` fee routing.
 *
 * Pure on purpose: this decides WHICH CONTRACT and WHICH AMOUNT get signed, so it
 * is the part of the payment path that must be testable without a wallet. The
 * provider call lives in `sign-payment.ts` (pay a merchant) and `sign-transfer.ts`
 * (send to any address).
 *
 * The recipient is an ADDRESS, not a merchant. A merchant payout address and a
 * person's wallet are the same calldata with a different first argument, so the
 * send path reuses this function unchanged — there is no separate merchant
 * signing mechanism to find.
 *
 * The amount must be the server's `grossAsset` (principal + fee), never a
 * client-computed figure, and never `total` — `total` includes the gas figure,
 * and gas is paid to the chain, not to the recipient. Derive it here from the one
 * string the server gave us and never from UI state — this is the exact seam
 * where mobile shipped a bug that sent the principal instead of the gross and
 * underpaid every merchant.
 * (In `batch` mode there is no gross: the fee is its own leg. See
 * {@link buildBatchTransfer}.)
 */
export function buildTransfer(input: {
  asset: SupportedAsset;
  /** Who receives it: a merchant payout address, or another person's wallet. */
  recipientAddress: Address;
  /** The gross in the asset's own units, as a decimal string. */
  grossAmount: string;
  /**
   * The network the ACCOUNT is acting on — where this transfer will be signed.
   * Required, with no default on purpose: the client used to read the deployment's
   * chain here, which is the bug this parameter exists to close. See `chainConfigFor`.
   */
  network: Network;
}): TokenTransfer {
  const decimals = ASSET_DECIMALS[input.asset];
  const value = parseUnits(input.grossAmount, decimals);

  // `BigInt(0)`, not `0n`: this package targets below ES2020, where bigint
  // literals are a compile error.
  if (value <= BigInt(0)) {
    throw new Error(`Refusing to sign a non-positive transfer: ${input.grossAmount}`);
  }

  return {
    to: getTokenContractFor(input.asset, input.network),
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [input.recipientAddress, value],
    }),
    value: BigInt(0),
  };
}

/**
 * The batch: principal to the recipient, fee to the treasury, ONE transaction.
 *
 * This is how the 2% is actually collected. The two calls are separate transfers
 * inside Tempo's `calls` array, so they execute atomically — the recipient is
 * paid and Seti is paid, or neither happens. No contract, no custodian, no
 * relayer: the customer's own signature moves both legs.
 *
 * Both amounts come from the server's preview (`amount` and `feeInAsset`), never
 * from UI state, for the same reason as the single-transfer path: the client's
 * job is to sign what it was quoted, and the backend then verifies BOTH legs
 * against the receipt before writing anything.
 */
export function buildBatchTransfer(input: {
  asset: SupportedAsset;
  /** The merchant's payout address, or the person being sent to. */
  recipientAddress: Address;
  /** The principal in the asset's own units, as a decimal string. */
  principalAmount: string;
  /** The fee leg, in the asset's own units, as a decimal string. */
  feeAmount: string;
  /** Where the fee goes. Server-supplied — never invented here. */
  treasuryAddress: Address;
  /** The network the ACCOUNT is acting on. See {@link buildTransfer}. */
  network: Network;
}): TempoCall[] {
  const decimals = ASSET_DECIMALS[input.asset];

  const principal = toPositiveUnits(input.principalAmount, decimals, 'principal');
  const fee = toPositiveUnits(input.feeAmount, decimals, 'fee');

  // A zero fee leg would make the batch two calls of which one moves nothing.
  // That is not a cheaper payment, it is a mis-signed one: refuse before the
  // wallet sees it.
  const encode = (recipient: Address, value: bigint): TempoCall => ({
    to: getTokenContractFor(input.asset, input.network),
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, value],
    }),
    value: BigInt(0),
  });

  return [encode(input.recipientAddress, principal), encode(input.treasuryAddress, fee)];
}

function toPositiveUnits(amount: string, decimals: number, label: string): bigint {
  const value = parseUnits(amount, decimals);
  if (value <= BigInt(0)) {
    throw new Error(`Refusing to sign a non-positive ${label}: ${amount}`);
  }
  return value;
}

/**
 * The Tempo envelope around a set of calls.
 *
 * `feeToken` is the asset being spent, not a fixed token: the customer pays
 * their own gas, so the fee has to come out of a balance they demonstrably hold,
 * and Tempo's Fee AMM converts it to whatever the validator prefers. Leaving it
 * unset would let the chain fall back to pathUSD, which an OUSD-only customer
 * cannot pay — the failure the old client code refused to guess about.
 */
export function buildTempoTransaction(input: {
  asset: SupportedAsset;
  calls: TempoCall[];
  /** The network the ACCOUNT is acting on. See {@link buildTransfer}. */
  network: Network;
}): TempoTransactionRequest {
  return {
    type: TEMPO_TRANSACTION_TYPE,
    // The same network the token contracts were resolved for — one call, one
    // source. `chainConfigFor` refuses mainnet unless the build opted in, so the
    // chain id and the addresses can never name different networks.
    chainId: chainConfigFor(input.network).chainId,
    feeToken: getTokenContractFor(input.asset, input.network),
    calls: input.calls,
  };
}
