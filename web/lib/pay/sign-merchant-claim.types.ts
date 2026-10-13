import type { Address, EIP1193Provider } from 'viem';

/** The exact fields the wallet is asked to display and sign. */
export interface MerchantClaimMessage {
  name: string;
  address: string;
  issuedAt: string;
  nonce: string;
}

export interface SignMerchantClaimInput {
  provider: EIP1193Provider;
  /** The embedded wallet's address — the address the name is claimed FOR. */
  address: Address;
  name: string;
}

export interface SignMerchantClaimResult {
  /** The signed message, verbatim, to send back with the signature. */
  message: MerchantClaimMessage;
  signature: string;
}

export interface MerchantClaimTypedData {
  domain: { name: string; version: string; chainId: number };
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: string;
  message: MerchantClaimMessage;
}
