import type { Address } from 'viem';
import type { SendPreview } from '@/lib/api';
import type { SupportedAsset } from '@/lib/chain';
import type { Network } from '@/lib/network';
import { buildBatchTransfer, buildTempoTransaction } from './build-transfer';
import type { SendTempoTransaction } from './build-transfer.types';

/**
 * Send to a person — the same transaction as a batched merchant payment, with a
 * different first recipient.
 *
 * There is no P2P-only signing mechanism: a merchant payout address and a
 * person's wallet are both just the first argument of a TIP-20 `transfer`, and
 * both paths build their calls in `build-transfer.ts`.
 *
 * ## Batch only, and why
 *
 * The server quotes sends in `batch` mode exclusively (`previewSend` refuses
 * `inside-transfer`), because with no merchant in the path the fee riding inside
 * a single transfer would be paid TO the recipient. So this refuses anything
 * that is not a batch rather than falling back to a single transfer: failing
 * closed on a mis-priced send is the whole point.
 *
 * ## What this signs
 *
 *   transfer(recipient, preview.amount)          — the principal
 *   transfer(treasury,  preview.feeInAsset)      — the 2%, collected
 *
 * Both amounts come from the server's preview, and both legs are then re-read
 * from the receipt by `recordSend` before any ledger row exists. A signed send
 * that the chain does not corroborate is not a send.
 */
export interface SignSendInput {
  preview: SendPreview;
  asset: SupportedAsset;
  /** The batch mechanism, from the Privy Tempo hook. */
  sendTempoTransaction: SendTempoTransaction;
  /**
   * The network the ACCOUNT is acting on. Required: it decides which chain id and
   * which token contract get signed, and the account's network is the only correct
   * answer — not the one this deployment happens to serve.
   */
  network: Network;
}

export interface SignSendResult {
  txHash: string;
}

export async function signSend(input: SignSendInput): Promise<SignSendResult> {
  const { preview, asset, sendTempoTransaction, network } = input;

  if (preview.feeRoutingMode !== 'batch') {
    throw new Error(
      `This send was quoted in \`${preview.feeRoutingMode}\` mode, where the fee would be ` +
        'paid to the recipient rather than collected. Refusing to sign it.'
    );
  }

  const calls = buildBatchTransfer({
    asset,
    recipientAddress: preview.recipient as Address,
    principalAmount: preview.amount,
    feeAmount: preview.feeInAsset,
    treasuryAddress: preview.treasuryAddress as Address,
    network,
  });

  const txHash = await sendTempoTransaction(buildTempoTransaction({ asset, calls, network }));

  if (!txHash || typeof txHash !== 'string') {
    throw new Error('The wallet returned no transaction hash.');
  }

  return { txHash };
}
