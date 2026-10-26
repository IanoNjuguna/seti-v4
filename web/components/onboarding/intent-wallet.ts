import { claimErrorView } from '@/components/merchant/Claim.error';
import { refusalMessageFor } from '@/lib/api/refusal.constants';
import type { ClaimFailure } from '@/components/merchant/Claim.error';
import type {
  EmbeddedWalletStatus,
  WalletRepairFailureCode,
} from '@/hooks/useEmbeddedWallet.types';

/**
 * What step three of onboarding may offer, and what it must say.
 *
 * ## Why this is not decided in the component
 *
 * The rule is a precedence, and a precedence written inline is a rule nobody can
 * test: the render is checked by reading markup, but "does a claim's own refusal
 * outrank the wallet's absence" is a question about the decision, not the pixels.
 *
 * ## The precedence
 *
 *  1. **A claim that failed.** The person acted; what happened to that action is
 *     what they are owed, even on a device where the wallet has since gone away.
 *  2. **No wallet at all.** Nothing was attempted and nothing can be, so the step
 *     says so BEFORE it offers a tap that cannot complete, and carries the controls
 *     that fix it. This is the case that walled a new account out: the options
 *     were offered, the tap failed, and the failure was blamed on the name.
 *  3. **A wallet still loading.** A moment, not a fault. Same treatment, a sentence
 *     that promises nothing more than "in a moment".
 *
 * An option is only offerable when there is a wallet that can sign: `canChoose` is
 * exactly that, and the surface disables rather than hides, so the step keeps its
 * shape on a device where the answer is no.
 *
 * ## Signing out is the FALLBACK, never the first offer (#226)
 *
 * `wallet-missing` used to carry one control, "Sign in again", because the app had
 * no other way to get a wallet onto the device. It has one now: the account's own
 * registered address can be resolved, Privy's user can be re-read, and a wallet can
 * be created in place — so `canRepair` is what the surface reads first, and
 * `needsSignIn` stays true BESIDE it rather than instead of it.
 *
 * After a repair that produced nothing, the repair is NOT offered again: the same
 * failing call, pressed again, fails identically. That state offers the sign-in
 * and the sentence that names what went wrong.
 */
export interface WalletRepairState {
  /** False on a build with no Privy app, where there is nothing to create. */
  canRepair: boolean;
  /** True while a repair is in flight, so the control can show it. */
  repairing: boolean;
  /** The cause of the last repair that produced nothing, or null. */
  failureCode: WalletRepairFailureCode | null;
}

export interface IntentWalletFailure {
  blockError: string;
  reference: string | null;
  /** True when a sign-in is a way out of this, which is most wallet states. */
  needsSignIn: boolean;
  /** True when the app can put a wallet on this device without signing out. */
  canRepair: boolean;
}

export interface IntentWalletState {
  /** False when tapping an option would start something that cannot finish. */
  canChoose: boolean;
  /** The failure to render under the options, or null when there is none. */
  failure: IntentWalletFailure | null;
}

/**
 * What an untouched wallet looks like: nothing has been tried, so a repair is
 * still on the table and no cause is known.
 */
export const WALLET_UNREPAIRED: WalletRepairState = {
  canRepair: true,
  repairing: false,
  failureCode: null,
};

export function intentWalletState(
  walletStatus: EmbeddedWalletStatus,
  claim: ClaimFailure,
  repair: WalletRepairState = WALLET_UNREPAIRED
): IntentWalletState {
  const view = claimErrorView(claim);
  // A repair that has already run and left nothing is spent: offering it again is
  // the same tap, and the sign-in is what remains.
  const canRepair = repair.canRepair && repair.failureCode === null;

  if (view.blockError) {
    const walletFailed = claim.errorCode === 'wallet-missing';

    return {
      canChoose: walletStatus === 'ready',
      failure: {
        blockError: view.blockError,
        reference: view.reference,
        needsSignIn: walletFailed,
        canRepair: walletFailed && canRepair,
      },
    };
  }

  if (walletStatus === 'missing') {
    return {
      canChoose: false,
      failure: {
        // A failed repair says what actually happened; otherwise the sentence is
        // `wallet-missing`'s own, whose meaning has not changed: there is nothing
        // on this device that can sign.
        blockError: refusalMessageFor(repair.failureCode ?? 'wallet-missing'),
        reference: null,
        needsSignIn: true,
        canRepair,
      },
    };
  }

  if (walletStatus === 'loading') {
    return {
      canChoose: false,
      failure: {
        blockError: refusalMessageFor('wallet-not-ready'),
        reference: null,
        needsSignIn: false,
        canRepair: false,
      },
    };
  }

  return { canChoose: true, failure: null };
}
