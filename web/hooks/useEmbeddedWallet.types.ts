import type { Address, EIP1193Provider } from 'viem';

/** Whether a usable embedded wallet exists yet. */
export type EmbeddedWalletStatus = 'loading' | 'ready' | 'missing';

/**
 * Whether PRIVY's own session is alive, which is a different session from ours.
 *
 * Two sessions exist whenever a person is in the product: the Seti session
 * (`GET /auth/verify`, `useSession`) and Privy's, which is what hands out the
 * signed-in user and therefore the embedded wallet. They can disagree, and until
 * #241 nothing read the second one:
 *
 *  - `live` — Privy reports an authenticated user, or has not finished starting yet
 *    (`usePrivy().ready` is false), so there is nothing to conclude.
 *  - `expired` — Privy's SDK is ready and reports NO authenticated user while OUR
 *    session says signed-in. The observed symptom is `GET /api/v1/users/me`
 *    answering 401, which empties `useWallets()` because Privy could not load a
 *    user, not because a wallet list lagged.
 *
 * It is its own state because neither repair in #229/#233 can work in it:
 * `refreshUser()` re-reads a user that is not there, and `createWallet()` needs a
 * live session to create into. `loading` is not this state either: a list that is
 * late will arrive, and this one will not.
 */
export type PrivySessionState = 'live' | 'expired';

/**
 * Why a repair left nothing that can sign, as a code the copy table speaks.
 *
 *  - `wallet-missing` — the account HAS a wallet and this browser still cannot
 *    see one, so there was nothing to create: signing in again is what binds it.
 *  - `wallet-create-failed` — there was no wallet anywhere, creation was tried,
 *    and it failed. The cause is logged; this is the code the surface prints.
 *  - `wallet-session-expired` — nothing was attempted because nothing could be:
 *    Privy's own session is over, so there is no user to create a wallet for
 *    (#241). Reachable only through `repair` called directly; the surface reads
 *    {@link EmbeddedWalletValue.privySession} and does not offer it at all.
 *
 * Codes rather than sentences, for the reason `refusal.constants.ts` exists: the
 * person reads OUR sentence for the code, and one failed wallet reads the same
 * wherever it is shown.
 */
export type WalletRepairFailureCode =
  | 'wallet-missing'
  | 'wallet-create-failed'
  | 'wallet-session-expired';

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
  /**
   * Whether PRIVY's own session is alive (#241).
   *
   * Read by the two consumers that offer a way out of a state where nothing can
   * sign: the intent step, which must print the expiry rather than a missing
   * wallet and must not offer a repair, and the claim's pre-signature guard, which
   * names the cause it can see.
   *
   * `canSign` and `canRepair` both already fold this in. It is exposed BESIDE them
   * because a fact that is folded in cannot be said: two different states would
   * otherwise read the same sentence, which is the defect this issue exists for.
   */
  privySession: PrivySessionState;
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
   * Whether {@link repair} can do anything at all. False in two states, and both are
   * honest rather than a limitation: a build with no Privy app, where there is no
   * wallet to create, and a session whose Privy half has expired (#241), where there
   * is no user to create one for. Offering the control in either would be a button
   * that cannot work.
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
