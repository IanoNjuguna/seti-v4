import type { AccountIntent } from '@/lib/api';
import type { ClaimFailure } from '@/components/merchant/Claim.error';
import type { UseMerchantClaimReturn } from '@/hooks/useMerchantClaim.types';

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
  onChoose: (intent: AccountIntent) => void;
  /**
   * Leave for `/signin` and come back with a wallet.
   *
   * Offered only for `wallet-missing`, the one refusal that pressing the same
   * control cannot fix.
   */
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
