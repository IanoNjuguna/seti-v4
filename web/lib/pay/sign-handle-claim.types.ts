import type { Address, EIP1193Provider } from 'viem';
import type { HandleKind } from '@/lib/api/handles.types';

/** The exact fields the wallet is asked to display and sign. */
export interface HandleClaimMessage {
  name: string;
  address: string;
  /** `username` or `merchant-name` — the kind of claim these bytes authorise. */
  purpose: string;
  issuedAt: string;
  nonce: string;
}

export interface SignHandleClaimInput {
  provider: EIP1193Provider;
  /** The embedded wallet's address — the address the handle is claimed FOR. */
  address: Address;
  /** Person or business — selects the purpose that goes INTO the signed message. */
  kind: HandleKind;
  /** The username or the business name. */
  name: string;
}

export interface SignHandleClaimResult {
  /** The signed message, verbatim, to send back with the signature. */
  message: HandleClaimMessage;
  signature: string;
}

export interface HandleClaimTypedData {
  domain: { name: string; version: string; chainId: number };
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: string;
  message: HandleClaimMessage;
}
