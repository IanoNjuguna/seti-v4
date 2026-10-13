import { post } from './client';

/**
 * The shareable link for one of the caller's own receipts.
 *
 * The server returns a PATH, not an absolute URL: the browser knows its own
 * origin, so the link is composed where it is used and works through a tunnel or
 * a preview host without the backend guessing its own public name.
 */
export interface ReceiptLink {
  /** `/r/<opaqueId>?t=<token>` — relative, to be resolved against the origin. */
  path: string;
  /** ISO 8601. The capability is read-only and stops working at this instant. */
  expiresAt: string;
}

/**
 * Mint the capability link for a receipt the caller owns.
 *
 * Requires a session: this is the owner's door, and minting is the act of sharing.
 * A row that is not the caller's — or has nothing on chain — comes back as a 404.
 */
export function mintReceiptLink(transactionId: string): Promise<ReceiptLink> {
  return post<ReceiptLink>(
    `/transactions/${encodeURIComponent(transactionId)}/receipt-link`,
    {}
  );
}
