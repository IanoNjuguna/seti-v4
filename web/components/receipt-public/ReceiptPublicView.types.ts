import type { ReceiptDocument } from '@/lib/api';

/**
 * Props for the shared receipt's view.
 *
 * The document is fetched server-side by the page (so an unknown link is a real
 * 404 and the title can be decided before render), then handed to a client view
 * that draws the card and its QR.
 */
export interface ReceiptPublicViewProps {
  /** The receipt document, as the public endpoint returned it. */
  receipt: ReceiptDocument;
  /** The opaque public id, taken from the path. */
  receiptId: string;
  /** The capability token, taken from the query. */
  token: string;
}
