import { tempoChain } from '@/lib/chain';
import type {
  MerchantClaimMessage,
  MerchantClaimTypedData,
  SignMerchantClaimInput,
  SignMerchantClaimResult,
} from './sign-merchant-claim.types';

/**
 * The merchant-name claim, signed as EIP-712 typed data.
 *
 * ## Why typed data and not a plain personal_sign
 *
 * A `personal_sign` of a string is opaque in a wallet: the person approves hex
 * they cannot read. EIP-712 gives the wallet labelled fields to display — the
 * name, and the address the name is being attached to — and domain-separates the
 * signature with our app name, a version, and the Tempo chain id, so it cannot be
 * replayed against another app or on another chain.
 *
 * ## This must match the backend byte for byte
 *
 * `backend/src/services/merchant-claims.ts` defines the same domain, type name,
 * field order and field types. A signature over a different domain recovers to a
 * different address and the backend refuses it — which is the correct, safe
 * failure, but it means these two files move together.
 *
 * ## Not a transaction
 *
 * Nothing is signed for the chain here: no gas, no nonce on the network, no
 * transfer. This is a one-time statement ("this name is this address") that the
 * backend stores so the binding can be re-verified by anyone later.
 */
export const MERCHANT_CLAIM_DOMAIN_NAME = 'Seti';
export const MERCHANT_CLAIM_DOMAIN_VERSION = '1';
export const MERCHANT_CLAIM_PRIMARY_TYPE = 'MerchantNameClaim';

export const MERCHANT_CLAIM_TYPES = {
  MerchantNameClaim: [
    { name: 'name', type: 'string' },
    { name: 'address', type: 'address' },
    { name: 'issuedAt', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

export function buildMerchantClaim(message: MerchantClaimMessage): MerchantClaimTypedData {
  return {
    domain: {
      name: MERCHANT_CLAIM_DOMAIN_NAME,
      version: MERCHANT_CLAIM_DOMAIN_VERSION,
      // The chain the claim is for. Read from the live config so testnet and
      // mainnet claims are different signatures.
      chainId: tempoChain.id,
    },
    types: MERCHANT_CLAIM_TYPES,
    primaryType: MERCHANT_CLAIM_PRIMARY_TYPE,
    message,
  };
}

/** A one-time value, so two claims by the same wallet are never the same signature. */
function claimNonce(): string {
  return crypto.randomUUID();
}

/**
 * Trim, and collapse runs of whitespace — the same rule as
 * `backend/src/lib/merchant-name.ts`.
 *
 * This mirror matters for correctness, not tidiness: the backend normalises the
 * submitted name before it verifies the signature, so the string the wallet signs
 * MUST already be the normalised one. Signing `Java  House` (a stray double
 * space) while the backend verifies `Java House` would recover to a different
 * address and the claim would be refused — correctly, but with a confusing
 * message for a name that is plainly fine. Normalising here means the person gets
 * the name they meant, and a stray space is never a refusal.
 */
export function normalizeMerchantName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export async function signMerchantClaim(
  input: SignMerchantClaimInput
): Promise<SignMerchantClaimResult> {
  const message: MerchantClaimMessage = {
    // Normalised BEFORE signing: the signature must cover exactly the string the
    // backend will store and re-derive from.
    name: normalizeMerchantName(input.name),
    address: input.address,
    issuedAt: new Date().toISOString(),
    nonce: claimNonce(),
  };

  const signature = (await input.provider.request({
    method: 'eth_signTypedData_v4',
    // EIP-1193 form: [address, serialised typed data]. `types` deliberately omits
    // EIP712Domain — the wallet derives it from `domain`, and shipping our own
    // copy is what makes some wallets reject the request outright. Signature
    // requests are not transactions: this does not broadcast anything.
    params: [input.address, JSON.stringify(buildMerchantClaim(message))],
  })) as string;

  if (!signature || typeof signature !== 'string') {
    throw new Error('The wallet returned no signature for the claim.');
  }

  return { message, signature };
}
