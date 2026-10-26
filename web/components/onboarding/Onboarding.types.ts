import type { AccountIntent } from '@/lib/api';
import type { ClaimFailure } from '@/components/merchant/Claim.error';
import type {
  EmbeddedWalletStatus,
  WalletRepairFailureCode,
} from '@/hooks/useEmbeddedWallet.types';
import type { UseMerchantClaimReturn } from '@/hooks/useMerchantClaim.types';
import type { WalletRepairState } from './intent-wallet';

/**
 * The wizard's steps. `done` is not stored — it is derived from the claim having
 * landed, so it can never disagree with the claim's own state.
 */
export type OnboardingStep = 'sign-in' | 'username' | 'intent' | 'done';

export interface UseOnboardingReturn {
  /** Where the wizard is. `done` only once a claim has actually landed. */
  step: OnboardingStep;
  /** The claim this wizard runs — the SAME hook and form `/app/merchant` uses. */
  claim: UseMerchantClaimReturn;
  /**
   * The embedded wallet, as this page needs it: whether anything can sign, and
   * whether it can be fixed HERE.
   *
   * Read from its own instance of `useEmbeddedWallet` rather than threaded through
   * the claim, because the repair is the wizard's offer and not the claim's: a
   * claim cannot create a wallet, and the step that renders the failure is this
   * one.
   */
  wallet: {
    status: EmbeddedWalletStatus;
    /**
     * Whether THIS DEVICE can sign, which is what the intent step gates on (#233).
     *
     * Carried beside `status` rather than derived here: an address read from the
     * account is `ready` and cannot produce a signature, and the step that offers the
     * two intents must not learn that one fact by asking the other question.
     */
    canSign: boolean;
    repairing: boolean;
    failureCode: WalletRepairFailureCode | null;
    canRepair: boolean;
    repair: () => Promise<void>;
  };
  /** Which intent is currently signing, so the right option can show it. */
  pending: AccountIntent | null;
  /** Move from the name to the intent step. */
  toIntent: () => void;
  /** Choose an intent: record it, then sign and submit the claim for its kind. */
  choose: (intent: AccountIntent) => Promise<void>;
  /** Re-read the account and enter the app. */
  finish: () => Promise<void>;
  /** True while the account is being re-read and the app is being opened. */
  finishing: boolean;
  /**
   * Sign out and go to `/signin`, for a claim that has no wallet to sign with.
   *
   * The alternative on that refusal is "try again", which fails identically, so the
   * only honest control is the one that gets a wallet onto the device.
   */
  signInAgain: () => Promise<void>;
}

export interface OnboardingStepsProps {
  current: OnboardingStep;
}

export interface OnboardingIntentProps {
  /** The option currently signing, or null. */
  pending: AccountIntent | null;
  /** True while a wallet prompt or request is in flight. */
  busy: boolean;
  /**
   * The claim's own failure — the three fields `claimErrorView` reads.
   *
   * Passed rather than the pre-mapped sentence, because this step must NOT decide
   * what a failure means: a name problem belongs on the field and a wallet problem
   * belongs beside a sign-in, and that decision already exists in one place for the
   * claim form.
   */
  claim: ClaimFailure;
  /**
   * Whether anything on the device can sign.
   *
   * The step needs it for a reason that is not cosmetic: an option offered with no
   * wallet to sign with is a control that fails, and that failure is how a new
   * account came to be told its name was wrong.
   */
  walletStatus: EmbeddedWalletStatus;
  /**
   * Whether THIS device can produce the signature, which is what enables the two
   * options (#233).
   *
   * Passed separately from `walletStatus` on purpose. `ready` says an address is
   * known — possibly one the account holds and this browser does not — so the step
   * would otherwise offer both intents on a device where the tap cannot finish.
   */
  canSign: boolean;
  /**
   * What the repair can do about a missing wallet, and why it may have stopped
   * being offered. A decision input, not a cosy prop: see `intent-wallet.ts`.
   */
  walletRepair: WalletRepairState;
  onChoose: (intent: AccountIntent) => void;
  /**
   * Put a wallet on this device WITHOUT signing out — the first offer on a device
   * with no wallet, and the one control that fixes the state in place.
   */
  onRepair: () => void;
  /**
   * Leave for `/signin` and come back with a wallet.
   *
   * Since #226 the FALLBACK rather than the only control for `wallet-missing`: a
   * sign-in ends the session and costs an emailed code, so it is offered beside the
   * repair and alone only once the repair has failed.
   */
  onSignIn: () => void;
}

/** The repair controls, as one component renders them. */
export interface WalletRepairActionProps {
  /** Whether the repair is worth offering, which it is not once it has failed. */
  showRepair: boolean;
  /** Whether the sign-in is a way out of this state. */
  showSignIn: boolean;
  repairing: boolean;
  onRepair: () => void;
  onSignIn: () => void;
}

/** One of the two intents, as a control that performs the claim for its kind. */
export interface IntentOptionProps {
  intent: AccountIntent;
  title: string;
  body: string;
  action: string;
  /** The option currently signing, or null. */
  pending: AccountIntent | null;
  busy: boolean;
  /**
   * True when this control cannot complete at all, because nothing on the device
   * can sign. Distinct from `busy`: that one ends, this one needs a sign-in.
   */
  disabled?: boolean;
  onChoose: (intent: AccountIntent) => void;
}

/** The step body — everything under the header, chosen by the current step. */
export interface OnboardingBodyProps {
  wizard: UseOnboardingReturn;
}

/** Step four: the claim's own result, plus the way into the app. */
export interface OnboardingDoneProps {
  claim: UseMerchantClaimReturn;
  finishing: boolean;
  onFinish: () => void;
}
