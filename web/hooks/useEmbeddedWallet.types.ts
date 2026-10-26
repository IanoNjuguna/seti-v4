import type { Address, EIP1193Provider } from 'viem';

/** Whether a usable embedded wallet exists yet. */
export type EmbeddedWalletStatus = 'loading' | 'ready' | 'missing';

/**
 * Why a repair left nothing that can sign, as a code the copy table speaks.
 *
 *  - `wallet-missing` — the account HAS a wallet and this browser still cannot
 *    see one, so there was nothing to create: signing in again is what binds it.
 *  - `wallet-create-failed` — there was no wallet anywhere, creation was tried,
 *    and it failed. The cause is logged; this is the code the surface prints.
 *
 * Codes rather than sentences, for the reason `refusal.constants.ts` exists: the
 * person reads OUR sentence for the code, and one failed wallet reads the same
 * wherever it is shown.
 */
export type WalletRepairFailureCode = 'wallet-missing' | 'wallet-create-failed';

/** A signing provider plus the account it signs for. */
export interface SigningWallet {
  provider: EIP1193Provider;
  address: Address;
}

export interface EmbeddedWalletValue {
  status: EmbeddedWalletStatus;
  /**
   * Whether THIS DEVICE can produce a signature right now.
   *
   * A different question from {@link status}, and the reason this field exists:
   * `status` answers "do we know an address to bind", and since #226 that address
   * can come from the ACCOUNT (`GET /users/:id/wallets`) rather than from the wallet
   * list. An account's registered address is a fact about the account; it is not
   * evidence that a key for it is on this browser. So `ready` with
   * `canSign === false` is an ordinary state — signed in, wallet registered, nothing
   * here that can sign — and only this field may gate a control that asks for a
   * signature.
   *
   * The definitions live in `useEmbeddedWallet` rather than in the decision that
   * reads them, so the two questions cannot be re-derived by accident.
   *
   * This is additive on purpose. `status` keeps its meaning for the five surfaces
   * that already read it (payments, save, send, claim, onboarding); tightening one
   * of them must not flip the other four (#233).
   */
  canSign: boolean;
  /** The embedded wallet's address, or null when there is none yet. */
  address: Address | null;
  /**
   * Resolves the signing wallet, or throws {@link NoEmbeddedWalletError}.
   * Async because the EIP-1193 provider is only available on demand.
   */
  getSigningWallet: () => Promise<SigningWallet>;
  /**
   * Get a wallet onto this device WITHOUT ending the session.
   *
   * Never rejects: every failure lands in `repairFailure`, because the caller is a
   * click handler and a rejection it forgets to catch is a control that silently
   * does nothing.
   */
  repair: () => Promise<void>;
  /**
   * Whether {@link repair} can do anything at all. False on a build with no Privy
   * app configured, where there is no wallet to create — offering the control
   * there would be a button that cannot work.
   */
  canRepair: boolean;
  /** True while {@link repair} is in flight. */
  repairing: boolean;
  /**
   * The cause of the last repair that produced nothing to sign with, or null.
   *
   * Read only while `status` is `missing`: a refresh that DID work flips the status
   * to `ready` on the next render, and the failure recorded on the way there is
   * history, not state the surface should render.
   */
  repairFailure: WalletRepairFailureCode | null;
}

/** Thrown when a payment is attempted with no embedded wallet available. */
export class NoEmbeddedWalletError extends Error {
  constructor() {
    super('No embedded wallet is available for this account yet.');
    this.name = 'NoEmbeddedWalletError';
  }
}
