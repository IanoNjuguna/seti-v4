import { post } from './client';
import type { ClaimedMerchant, ClaimMerchantNameRequest, ClaimMerchantNameResult } from './merchant-claim.types';

/**
 * Claim a business name for the wallet that signed it.
 *
 * The backend verifies the EIP-712 signature, checks the signer owns the address
 * and that the name is free, then STORES the signature — so this is a one-time
 * act, costs no gas, and writes nothing on chain. Refusals come back as an
 * {@link ApiError} carrying a machine-readable `code`.
 */
export async function claimMerchantName(
  input: ClaimMerchantNameRequest
): Promise<ClaimedMerchant> {
  const { merchant } = await post<ClaimMerchantNameResult>('/merchants/claim', input);
  return merchant;
}
