import { get, post } from './client';
import type {
  PaymentPreview,
  RecordPaymentInput,
  RecordPaymentResult,
  ResolvedMerchant,
} from './pay.types';

export async function resolveMerchant(qrPayload: string): Promise<ResolvedMerchant> {
  const encoded = encodeURIComponent(qrPayload);
  return get<ResolvedMerchant>(`/merchants/resolve?qr=${encoded}`);
}

export async function previewPayment(input: {
  userId: string;
  /** The amount the customer entered, in KES — not stablecoin units. */
  amountKes: string;
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
