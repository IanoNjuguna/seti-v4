import { get } from './client';
import type { MerchantHandlePreview, MerchantHandleStatusResult } from './merchant-handle.types';

/**
 * Ask the backend what handle a name will get and whether it is taken.
 *
 * This is the claim path's OWN validation, not a second rule written here, so
 * the preview cannot call a link free that the claim would then refuse. It sits
 * behind the same auth as the claim: a signed-in merchant checking a name it is
 * about to sign for, not anonymous name enumeration.
 */
export async function fetchMerchantHandle(name: string): Promise<MerchantHandlePreview> {
  const { status } = await get<MerchantHandleStatusResult>(
    `/merchants/handle?name=${encodeURIComponent(name)}`
  );
  return status;
}
