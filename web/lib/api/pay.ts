import { get, post } from './client';
import type {
  PaymentPreview,
  RecordPaymentInput,
  RecordPaymentResult,
  ResolvedMerchant,
} from './pay.types';

/**
 * Mirrors `mobile/src/lib/api/pay.ts` — same three endpoints, same shapes.
 *
 * Note what is NOT here: QR parsing. The payload goes to the server verbatim and
 * `backend/src/services/merchants.ts` decides whether it is a `seti://pay` URI, a
 * `merchant:<id>` string or a bare id. Parsing it here would be a second
 * implementation of a rule the backend already owns, and the two would drift.
 */
export async function resolveMerchant(qrPayload: string): Promise<ResolvedMerchant> {
  const encoded = encodeURIComponent(qrPayload);
  return get<ResolvedMerchant>(`/merchants/resolve?qr=${encoded}`);
}

export async function previewPayment(input: {
  userId: string;
  /** The amount the customer entered, in THEIR currency — not stablecoin units. */
  amountFiat: string;
  asset: string;
  merchantId: string;
}): Promise<{ preview: PaymentPreview }> {
  return post<{ preview: PaymentPreview }>('/transactions/preview', input);
}

export async function recordPayment(
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  return post<RecordPaymentResult>('/transactions/pay', input);
}
