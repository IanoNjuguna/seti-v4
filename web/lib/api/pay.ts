import { post } from './client';
import type {
  PaymentPreview,
  RecordPaymentInput,
  RecordPaymentResult,
} from './pay.types';

/**
 * Mirrors `mobile/src/lib/api/pay.ts` — same endpoints, same shapes.
 *
 * Note what is NOT here: resolving a merchant. A handle is resolved through the
 * ONE resolver (`resolveHandle`, `lib/api/handles.ts`), which accepts a
 * `seti://pay` URI, a `merchant:<id>` string, a handle or a name verbatim and
 * lets `backend/src/services/handles.ts` decide what it is. Parsing it here would
 * be a second implementation of a rule the backend already owns.
 */

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
