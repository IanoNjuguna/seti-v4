import type { AccountIntent } from '@/lib/api';
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
}

export interface OnboardingStepsProps {
  current: OnboardingStep;
}

export interface OnboardingIntentProps {
  /** The option currently signing, or null. */
  pending: AccountIntent | null;
  /** True while a wallet prompt or request is in flight. */
  busy: boolean;
  /** The claim's refusal, if it was refused. */
  error: string | null;
  onChoose: (intent: AccountIntent) => void;
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
