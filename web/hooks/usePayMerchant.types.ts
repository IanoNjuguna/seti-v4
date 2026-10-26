import type { HandleIdentity, PaymentPreview, SupportedAsset } from '@/lib/api';
import type { PayErrorKind } from '@/lib/pay/classify-payment-error';
import type { TokenSelectorModel } from '@/components/token-selector/TokenSelector.types';

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
  /**
   * The token the customer chose to pay from, or null while the server chooses the
   * row that covers (#228). This is a PIN on the quote: it is sent on every preview,
   * including the one that is signed, and a token that cannot cover the amount is
   * refused (never swapped) before anything is signed.
   */
  asset: SupportedAsset | null;
  preview: PaymentPreview | null;
  /**
   * The token the server would spend after a refused pin — the actionable half of
   * #223's refusal. Null when no single balance covers, which is when there is
   * nothing to offer and the sentence stands alone.
   */
  coverOffer: SupportedAsset | null;
  txHash: string | null;
  error: string | null;
  /** Machine-readable cause, so the UI can react without parsing copy. */
  errorKind: PayErrorKind | null;
  /** The server's refusal code when it sent one, so a surface can tell WHICH refusal. */
  errorCode: string | null;
}

export interface UsePayMerchantReturn extends PayState {
  setAmount: (amount: string) => void;
  /** Choose the balance that pays, by the label on its balance row. Null returns the
   * choice to the server. */
  setAsset: (asset: string | null) => void;
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
  /**
   * What the token selector draws (#228): the funded balances, the token the price
   * spends, the customer's pin, and #223's refusal with the token that could pay.
   * Derived on every render from the quote and the balance read, never stored.
   */
  tokenSelector: TokenSelectorModel;
}
