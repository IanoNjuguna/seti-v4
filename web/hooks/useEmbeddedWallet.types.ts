import type { Address, EIP1193Provider } from 'viem';

/** Whether a usable embedded wallet exists yet. */
export type EmbeddedWalletStatus = 'loading' | 'ready' | 'missing';

/** A signing provider plus the account it signs for. */
export interface SigningWallet {
  provider: EIP1193Provider;
  address: Address;
}

export interface EmbeddedWalletValue {
  status: EmbeddedWalletStatus;
  /** The embedded wallet's address, or null when there is none yet. */
  address: Address | null;
  /**
   * Resolves the signing wallet, or throws {@link NoEmbeddedWalletError}.
   * Async because the EIP-1193 provider is only available on demand.
   */
  getSigningWallet: () => Promise<SigningWallet>;
}

/** Thrown when a payment is attempted with no embedded wallet available. */
export class NoEmbeddedWalletError extends Error {
  constructor() {
    super('No embedded wallet is available for this account yet.');
    this.name = 'NoEmbeddedWalletError';
  }
}
