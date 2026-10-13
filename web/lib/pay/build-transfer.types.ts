import type { Hex } from 'viem';

/**
 * What the browser must send to move money: one TIP-20 `transfer`.
 *
 * `to` is the TOKEN CONTRACT, never the merchant — a TIP-20 transfer is a call
 * to the token with the recipient in the calldata. Passing the merchant as `to`
 * would send a valueless call to an EOA and move nothing.
 */
export interface TokenTransfer {
  to: `0x${string}`;
  data: Hex;
  /** Always 0n: TIP-20 has no native value leg. */
  value: bigint;
}

/**
 * One call inside a Tempo transaction.
 *
 * The same three fields as {@link TokenTransfer}: on Tempo the calls *are* the
 * transaction, so a `TokenTransfer` is already a valid call.
 */
export interface TempoCall {
  to: `0x${string}`;
  data: Hex;
  value?: bigint;
}

/**
 * Tempo's native transaction envelope (EIP-2718, serialized as `0x76`).
 *
 * `calls` replaces the top-level `to`/`data`: an array of calls executes
 * atomically, so a principal leg and a fee leg either both land or neither does.
 * That atomicity is what makes the 2% collectable without Seti holding funds or
 * relaying anything.
 *
 * `feeToken` names the TIP-20 the gas is paid in — Tempo has no native gas
 * token, and (decided 2026-10-10) the customer funds their own gas.
 */
export interface TempoTransactionRequest {
  /**
   * 118 — Tempo's type, as a literal: the wallet hook's parameter type is the
   * literal too, so widening this to `number` would fail to type-check against
   * the very call it is built for. See TEMPO_TRANSACTION_TYPE in
   * `build-transfer.ts`.
   */
  type: 118;
  chainId: number;
  /** The TIP-20 the fee is paid in. Omitted means Tempo's preference rules. */
  feeToken?: `0x${string}`;
  calls: TempoCall[];
}

/**
 * The wallet's batch mechanism, injected by a hook.
 *
 * `lib/pay` decides WHICH calls and WHICH amounts; the wallet decides how to
 * sign. Keeping that split is why this is a function parameter rather than a
 * Privy import: the money rules stay readable and testable without a wallet, and
 * swapping the signer does not touch them.
 */
export type SendTempoTransaction = (request: TempoTransactionRequest) => Promise<string>;
