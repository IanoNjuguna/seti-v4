import { API_BASE_URL } from './api.constants';
import type { ReceiptDocument } from './receipt.types';

/**
 * The receipt behind a shared link, read by anyone holding the token.
 *
 * This is the one receipt read that carries NO Authorization header: the
 * capability lives in `?t=`, and the point of the link is that someone without a
 * Seti session can open it. It hits `/receipts/:id`, which has no auth hook.
 *
 * `null` means "no receipt for that link" — an unknown id, a missing token, a
 * forged one, or an expired one, which the backend deliberately makes
 * indistinguishable. The page turns it into `notFound()`. Any other failure is
 * thrown and becomes a real error, never a fake 404: a backend that is down must
 * not read to a stranger as "this receipt does not exist".
 */
export async function fetchPublicReceipt(
  receiptId: string,
  token: string
): Promise<ReceiptDocument | null> {
  const query = token.length > 0 ? `?t=${encodeURIComponent(token)}` : '';

  const response = await fetch(
    `${API_BASE_URL}/receipts/${encodeURIComponent(receiptId)}${query}`,
    // A shared link is a live capability: expiry is enforced server-side, so the
    // answer is never served from Next's cache.
    { cache: 'no-store' }
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Could not load this receipt (${response.status}).`);
  }

  return (await response.json()) as ReceiptDocument;
}
