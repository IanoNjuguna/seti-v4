import type { ClaimedMerchant } from '@/lib/api/merchant-claim.types';

/**
 * The public page's shapes. It is fed the same `ClaimedMerchant` the backend's
 * identity view returns, so the page and the pay flow can never disagree about
 * what a merchant is.
 */
export interface MerchantPublicViewProps {
  merchant: ClaimedMerchant;
}

export interface MerchantIdentityProps {
  merchant: ClaimedMerchant;
}

export interface MerchantPayActionProps {
  /** The stored handle, carried into the pay flow as `?handle=`. */
  handle: string;
}
