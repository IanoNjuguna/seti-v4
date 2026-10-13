import type { HandleIdentity } from '@/lib/api';

/**
 * The public page's shapes. It is fed the same `HandleIdentity` the backend's
 * identity view returns, so a business page and a person page can never disagree
 * about what a handle is.
 */
export interface MerchantPublicViewProps {
  merchant: HandleIdentity;
}

export interface MerchantIdentityProps {
  merchant: HandleIdentity;
}

export interface MerchantPayActionProps {
  /** The stored handle, carried into the pay flow as `?handle=`. */
  handle: string;
}
