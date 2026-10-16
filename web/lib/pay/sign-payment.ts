import type { Address, EIP1193Provider } from 'viem';
import type { Network } from '@/lib/network';
import type { HandleIdentity, PaymentPreview, SupportedAsset } from '@/lib/api';
import { buildBatchTransfer, buildTempoTransaction, buildTransfer } from './build-transfer';
import type { SendTempoTransaction } from './build-transfer.types';

/**
 * The merchant payment seam — where the browser talks to a wallet for a Pay.
 *
 * Everything either side of it is finished and tested against the real backend:
 * merchant resolution, the preview, the state machine, the recording of the
 * payment, the error classification. This module holds no React state and
 * decides exactly three things: which contract, which amount, and how many legs.
 *
 * ## The two modes, and who chooses
 *
 * The server chooses. `preview.feeRoutingMode` is `batch` or `inside-transfer`,
 * and a modified client cannot ask for the cheaper one — it simply fails
 * reconciliation, because `recordPayment` re-reads the receipt.
 *
 * - **`batch`** — the 2% is COLLECTED. One Tempo transaction (type 118) carrying
 *   two calls: the principal to the merchant, the fee to the treasury. Atomic,
 *   so a payment cannot land with the fee missing. Signed through
 *   `sendTempoTransaction`, which the Privy Tempo hook provides.
 * - **`inside-transfer`** — one TIP-20 transfer of the gross to the merchant, fee
 *   included. The merchant is overpaid by the fee and Seti collects nothing; this
 *   is the historical behaviour, kept for comparison, not for revenue.
 *
 * ## The amount rule
 *
 * In `inside-transfer` mode the amount is `preview.grossAsset` (principal + fee),
 * read from the ARGUMENT — never from captured state, and never `total`, which
 * adds the gas figure. Mobile shipped a stale-closure bug that sent the principal
 * on the first payment instead and underpaid the merchant, because the preview
 * was still `null` when the click was handled. `buildTransfer` also refuses a
 * non-positive amount.
 *
 * In `batch` mode there is no single amount: the principal and the fee are two
 * separate legs, and both come from the same preview (`amount`, `feeInAsset`).
 */

/** viem's EIP-1193 provider type — what `wallet.getEthereumProvider()` returns. */
export type SigningProvider = EIP1193Provider;

export interface SignPaymentInput {
  preview: PaymentPreview;
  /** The resolved business handle being paid — the address below is what is signed. */
  merchant: HandleIdentity;
  asset: SupportedAsset;
  /** The single-transfer mechanism. Used in `inside-transfer` mode. */
  provider: SigningProvider;
  /**
   * The batch mechanism, from the Privy Tempo hook. Required in `batch` mode:
   * an EIP-1193 provider cannot carry `calls` (viem's RPC formatter drops them),
   * so the two are not interchangeable.
   */
  sendTempoTransaction?: SendTempoTransaction;
  /** The embedded wallet's address — the `from` of the transfer. */
  from: Address;
  /**
   * The network the ACCOUNT is acting on. Required: it decides the chain id and the
   * token contract this payment is signed against, and the account's network is the
   * only correct answer — see `chainConfigFor`.
   */
  network: Network;
}

export interface SignPaymentResult {
  /** One hash for the whole payment, in either mode. */
  txHash: string;
}

export class SigningNotConfiguredError extends Error {
  constructor() {
    super(
      'No wallet is available to sign with. Sign in with Privy, and make sure embedded wallets are enabled for Ethereum on the app id in use.'
    );
    this.name = 'SigningNotConfiguredError';
  }
}

/** The batch signer is missing while the server is asking for a batch. */
export class BatchSignerUnavailableError extends Error {
  constructor() {
    super(
      'This payment needs a batched signature (two transfers in one transaction), and ' +
        'the Tempo transaction hook is not available in this session.'
    );
    this.name = 'BatchSignerUnavailableError';
  }
}

export async function signPayment(input: SignPaymentInput): Promise<SignPaymentResult> {
  const { preview, merchant, asset, provider, from, network } = input;

  if (!merchant.address) {
    throw new Error('This merchant has no payout address, so there is nowhere to send.');
  }

  const payoutAddress = merchant.address as Address;

  if (preview.feeRoutingMode === 'batch') {
    const sendTempoTransaction = input.sendTempoTransaction;
    if (!sendTempoTransaction) throw new BatchSignerUnavailableError();

    // Both legs from the preview, never recomputed here: the backend verifies
    // the same two figures against the receipt.
    const calls = buildBatchTransfer({
      asset,
      recipientAddress: payoutAddress,
      principalAmount: preview.amount,
      feeAmount: preview.feeInAsset,
      treasuryAddress: preview.treasuryAddress as Address,
      network,
    });

    return { txHash: await sendTempoTransaction(buildTempoTransaction({ asset, calls, network })) };
  }

  const transfer = buildTransfer({
    asset,
    recipientAddress: payoutAddress,
    // `grossAsset`, not `total`: total includes the gas figure, and gas is paid
    // to the chain — sending it to the merchant would overpay them by it.
    grossAmount: preview.grossAsset,
    network,
  });

  // No `value` leg: TIP-20 has no native transfer, so the call carries calldata
  // only. `to` is the TOKEN CONTRACT, never the merchant — the recipient goes in
  // the calldata (see `build-transfer.types.ts`).
  const txHash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: transfer.to, data: transfer.data }],
  })) as string;

  if (!txHash || typeof txHash !== 'string') {
    throw new Error('The wallet returned no transaction hash.');
  }

  return { txHash };
}
