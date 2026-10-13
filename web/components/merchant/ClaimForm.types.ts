import type { ClaimedMerchant } from '@/lib/api/merchant-claim.types';
import type { MerchantHandlePreview } from '@/lib/api/merchant-handle.types';
import type { UseMerchantClaimReturn } from '@/hooks/useMerchantClaim.types';

/** The whole claim flow: the form and, once it lands, the result. */
export interface ClaimFormProps {
  claim: UseMerchantClaimReturn;
}

export interface ClaimResultProps {
  claimed: ClaimedMerchant;
  onAgain: () => void;
}

/**
 * The live handle preview. It takes the typed `name` rather than the computed
 * handle so it builds the shown link with the SAME `merchantLink` the result and
 * the QR use — one source for the string a merchant will print.
 */
export interface MerchantHandlePreviewProps {
  /** The name as typed. */
  name: string;
  /** The backend's verdict for this name's handle, or null while it is unknown. */
  preview: MerchantHandlePreview | null;
  /** True while a verdict for the current handle is in flight. */
  loading: boolean;
}

/** The printable QR of a merchant's link. */
export interface MerchantQrProps {
  /** The business name; the link is built from it with `merchantLink`. */
  name: string;
}
