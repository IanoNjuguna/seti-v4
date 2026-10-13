import type { HandleIdentity, PaymentPreview } from '@/lib/api';
import type { PayErrorKind } from '@/lib/pay/classify-payment-error';

/**
 * Steps a payment moves through. Mirrored from the mobile hook, with one
 * addition documented in `usePayMerchant.ts`: `idle` now also covers "amount
 * entered, live preview in flight", because the fee is shown before committing.
 */
export type PayStep =
  | 'idle'
  | 'resolving'
  | 'previewing'
  | 'signing'
  | 'recording'
  | 'done'
  | 'error'
  | 'insufficient-gas';

export interface PayState {
  step: PayStep;
  /**
   * The resolved handle being paid. In this flow it is always a business — a
   * merchant payment prices against the business profile (`merchantId`) — while
   * a person's handle is paid through Send. Same ONE identity type either way.
   */
  merchant: HandleIdentity | null;
  amount: string;
  preview: PaymentPreview | null;
  txHash: string | null;
  error: string | null;
  /** Machine-readable cause, so the UI can react without parsing copy. */
  errorKind: PayErrorKind | null;
}

export interface UsePayMerchantReturn extends PayState {
  setAmount: (amount: string) => void;
  resolve: (qrPayload: string) => Promise<void>;
  pay: () => Promise<void>;
  reset: () => void;
  /**
   * True while the debounced preview is in flight. Derved, never stored, so it
   * cannot disagree with `preview`.
   */
  previewLoading: boolean;
  /**
   * Terminal states are NOT busy. `error`, `insufficient-gas` and `done` mean
   * "nothing is happening and the user has something to do", so a busy
   * derivation that omits them disables the primary button at exactly the moment
   * the user is told how to recover. Mirrored from
   * `mobile/src/app/(tabs)/pay.tsx:39-43`, where that bug shipped once.
   */
  isBusy: boolean;
}
