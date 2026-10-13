import { get } from './client';
import type { ReceiptDocument } from './receipt.types';

/**
 * The receipt for one of the caller's own rows.
 *
 * Keyed by the ledger row's id, not the hash: the backend reads the chain for
 * that row and refuses a row that is not the caller's, so the id is the only
 * handle that can be authorised. A row with nothing on chain — or someone
 * else's — comes back as a 404 and surfaces as an `ApiError`.
 */
export function fetchReceipt(transactionId: string): Promise<ReceiptDocument> {
  return get<ReceiptDocument>(`/transactions/${encodeURIComponent(transactionId)}/receipt`);
}
