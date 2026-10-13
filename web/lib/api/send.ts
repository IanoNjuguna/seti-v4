import { post } from './client';
import type { RecordSendInput, RecordSendResult, SendPreview } from './send.types';

/**
 * Sending to a person: quote it, sign the quote, then have the server verify it.
 *
 * Three calls, in that order, mirroring the pay flow — and for the same reason.
 * The quote is the server's (the fee, the fx rate and the two leg amounts all
 * come from it), the signature is the wallet's, and `recordSend` re-reads both
 * legs off the chain before writing anything to the ledger.
 *
 * `previewSend` answers `422 { code: 'send-requires-batch' }` while the backend
 * is in `inside-transfer` mode: with no merchant in the path, the fee would be
 * paid to the recipient, so the server refuses to quote it at all.
 */
export async function previewSend(input: {
  /** The amount the customer entered, in THEIR currency — the same unit the pay screen takes. */
  amountFiat: string;
  asset: string;
  recipient: string;
}): Promise<{ preview: SendPreview }> {
  return post<{ preview: SendPreview }>('/transactions/send/preview', input);
}

export async function recordSend(input: RecordSendInput): Promise<RecordSendResult> {
  return post<RecordSendResult>('/transactions/send', input);
}
