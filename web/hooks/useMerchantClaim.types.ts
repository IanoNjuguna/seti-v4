import type { ClaimedMerchant } from '@/lib/api/merchant-claim.types';
import type { MerchantHandlePreview } from '@/lib/api/merchant-handle.types';

/**
 * Steps a claim moves through.
 *
 * `signing` and `submitting` are separate because they fail differently and the
 * person is told which one they are in: a wallet prompt that was dismissed is not
 * the same as a backend refusal, and conflating them sends people hunting for the
 * wrong problem.
 */
export type ClaimStep = 'idle' | 'signing' | 'submitting' | 'done' | 'error';

export interface MerchantClaimState {
  step: ClaimStep;
  /** What the person typed — the un-normalised name. */
  name: string;
  /** The merchant once the claim lands. */
  claimed: ClaimedMerchant | null;
  error: string | null;
  /** The backend's machine-readable refusal code, when it refused. */
  errorCode: string | null;
}

export interface UseMerchantClaimReturn extends MerchantClaimState {
  setName: (name: string) => void;
  claim: () => Promise<void>;
  reset: () => void;
  /** True while the wallet prompt or the request is in flight. */
  isBusy: boolean;
  /**
   * The handle the current name will get — the web's own `merchantHandle`, the
   * same string the backend stores. Recomputed on every keystroke, so the link
   * the merchant will print is visible before they sign.
   */
  handle: string;
  /**
   * The backend's verdict for THIS handle, or null when it does not apply yet.
   * Only ever the preview whose handle matches the one being shown — a preview
   * for a name the person has since changed is dropped rather than displayed.
   */
  preview: MerchantHandlePreview | null;
  /** True while a preview for the current handle is in flight. */
  previewLoading: boolean;
}
