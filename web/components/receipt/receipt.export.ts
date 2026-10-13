import type { ReceiptDocument } from '@/lib/api';
import { RECEIPT_FILE_PREFIX } from './Receipt.constants';
import { buildReceiptText } from './receipt.card';
import { receiptFileName } from './receipt.format';
import type { ShareOutcome } from './Receipt.types';

/**
 * Hand a file to the browser.
 *
 * A Blob URL plus a synthetic anchor click is the whole of it — no file library,
 * no dependency, and the name is chosen by the caller so the download is
 * identifiable later. The URL is revoked on the next turn so the browser has
 * started reading it first.
 */
function download(name: string, mimeType: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The whole response, verbatim: the complete machine-readable receipt.
 *
 * JSON is deliberately NOT the card. It is the format a reconciler, an
 * accountant or a support engineer reads, so it keeps everything the endpoint
 * returned — the block, the hash, every leg, the split fees — while the card and
 * the text export show what the customer was shown.
 */
export function downloadReceiptJson(receipt: ReceiptDocument): void {
  download(
    receiptFileName(receipt, 'json', RECEIPT_FILE_PREFIX),
    'application/json',
    JSON.stringify(receipt, null, 2)
  );
}

/** The text export IS the card: figure, payee, date, status, one fee line. */
export function downloadReceiptText(receipt: ReceiptDocument, currency: string | null): void {
  download(
    receiptFileName(receipt, 'txt', RECEIPT_FILE_PREFIX),
    'text/plain;charset=utf-8',
    buildReceiptText(receipt, currency)
  );
}

/** PDF is the browser's own print pipeline — no PDF library, no dependency. */
export function printReceipt(): void {
  window.print();
}

/**
 * Share the receipt as a link the recipient can open signed out.
 *
 * The shareable link (`shareUrl`) is the point of the action: it opens the receipt
 * itself, on any device, for a day, with no Seti account. When it could not be
 * minted the explorer URL is the fallback — the one other handle the recipient can
 * open anywhere. A share sheet the customer dismisses is not a failure.
 */
export async function shareReceipt(
  receipt: ReceiptDocument,
  shareUrl: string | null
): Promise<ShareOutcome> {
  const title = 'Seti transaction receipt';
  const url = shareUrl ?? receipt.explorerUrl;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text: `${title} — ${receipt.hash}`, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'dismissed';
      // Anything else (no permission, an unusable target): fall through to the
      // clipboard rather than leaving the customer with nothing.
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
