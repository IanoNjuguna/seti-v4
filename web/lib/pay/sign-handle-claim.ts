import { tempoChain } from '@/lib/chain';
import type { HandleKind } from '@/lib/api/handles.types';
import type {
  HandleClaimMessage,
  HandleClaimTypedData,
  SignHandleClaimInput,
  SignHandleClaimResult,
} from './sign-handle-claim.types';

/**
 * The handle claim, signed as EIP-712 typed data.
 *
 * ## Why typed data and not a plain personal_sign
 *
 * A `personal_sign` of a string is opaque in a wallet: the person approves hex
 * they cannot read. EIP-712 gives the wallet labelled fields to display — the
 * name, the purpose, and the address the name is being attached to — and
 * domain-separates the signature with our app name, a version, and the Tempo
 * chain id, so it cannot be replayed against another app or on another chain.
 *
 * ## Why the message carries a `purpose`
 *
 * A signature made to claim a USERNAME must not be replayable to claim a MERCHANT
 * name, or the reverse. The `purpose` sits INSIDE the signed bytes, so the same
 * signature verifies for exactly one of the two: the backend refuses a mismatch
 * with `purpose-mismatch`. `PURPOSE_FOR_KIND` is the one map that decides which
 * purpose a kind signs.
 *
 * ## This must match the backend byte for byte
 *
 * `backend/src/services/handle-claims.ts` defines the same domain, type name,
 * field order and field types. A signature over a different domain recovers to a
 * different address and the backend refuses it — which is the correct, safe
 * failure, but it means these two files move together.
 *
 * ## Not a transaction
 *
 * Nothing is signed for the chain here: no gas, no nonce on the network, no
 * transfer. This is a one-time statement ("this handle is this address") that the
 * backend stores so the binding can be re-verified by anyone later.
 */
export const HANDLE_CLAIM_DOMAIN_NAME = 'Seti';
export const HANDLE_CLAIM_DOMAIN_VERSION = '1';
export const HANDLE_CLAIM_PRIMARY_TYPE = 'HandleClaim';

/**
 * The purpose a kind signs under. Mirrors `PURPOSE_FOR_KIND` on the backend —
 * change one, change both, or a claim the app signs is refused by the server.
 */
export const PURPOSE_FOR_KIND: Record<HandleKind, string> = {
  person: 'username',
  business: 'merchant-name',
};

export const HANDLE_CLAIM_TYPES = {
  HandleClaim: [
    { name: 'name', type: 'string' },
    { name: 'address', type: 'address' },
    { name: 'purpose', type: 'string' },
    { name: 'issuedAt', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

export function buildHandleClaim(message: HandleClaimMessage): HandleClaimTypedData {
  return {
    domain: {
      name: HANDLE_CLAIM_DOMAIN_NAME,
      version: HANDLE_CLAIM_DOMAIN_VERSION,
      // The chain the claim is for. Read from the live config so testnet and
      // mainnet claims are different signatures.
      chainId: tempoChain.id,
    },
    types: HANDLE_CLAIM_TYPES,
    primaryType: HANDLE_CLAIM_PRIMARY_TYPE,
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
 * message for a name that is plainly fine.
 */
export function normalizeHandleName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export async function signHandleClaim(
  input: SignHandleClaimInput
): Promise<SignHandleClaimResult> {
  const message: HandleClaimMessage = {
    // Normalised BEFORE signing: the signature must cover exactly the string the
    // backend will store and re-derive from.
    name: normalizeHandleName(input.name),
    address: input.address,
    // The purpose is what makes this signature scoped to ONE kind of claim.
    purpose: PURPOSE_FOR_KIND[input.kind],
    issuedAt: new Date().toISOString(),
    nonce: claimNonce(),
  };

  const signature = (await input.provider.request({
    method: 'eth_signTypedData_v4',
    // EIP-1193 form: [address, serialised typed data]. `types` deliberately omits
    // EIP712Domain — the wallet derives it from `domain`, and shipping our own
    // copy is what makes some wallets reject the request outright. Signature
    // requests are not transactions: this does not broadcast anything.
    params: [input.address, JSON.stringify(buildHandleClaim(message))],
  })) as string;

  if (!signature || typeof signature !== 'string') {
    throw new Error('The wallet returned no signature for the claim.');
  }

  return { message, signature };
}
