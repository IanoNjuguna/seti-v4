'use client';

import { ClaimForm } from '@/components/merchant/ClaimForm';
import { ONBOARDING_NAME_COPY } from '@/components/merchant/Claim.constants';
import { OnboardingDone } from './OnboardingDone';
import { OnboardingIntent } from './OnboardingIntent';
import { OnboardingSignIn } from './OnboardingSignIn';
import type { OnboardingBodyProps } from './Onboarding.types';

/**
 * The step body, chosen by the current step. A switch rather than conditionals
 * spread through the header, so the header is the same four steps on every screen
 * and the only thing that moves is what is under it.
 *
 * Step two passes `linkKind={null}` and the claim form's own `submit` override, and
 * that pair is what keeps the intent step meaningful: the form collects the NAME
 * (no link yet, because the kind is not chosen; no signature yet, because the
 * purpose would be a guess), and step three signs.
 */
export function OnboardingBody({ wizard }: OnboardingBodyProps) {
  const { step, claim, pending, toIntent, choose, finish, finishing, signInAgain } = wizard;

  if (step === 'sign-in') return <OnboardingSignIn />;

  if (step === 'username') {
    return (
      <ClaimForm
        claim={claim}
        copy={ONBOARDING_NAME_COPY}
        linkKind={null}
        submit={{ label: ONBOARDING_NAME_COPY.submit, onPress: toIntent }}
      />
    );
  }

  if (step === 'intent') {
    return (
      <OnboardingIntent
        pending={pending}
        busy={claim.isBusy}
        claim={claim}
        walletStatus={claim.walletStatus}
        onChoose={(intent) => void choose(intent)}
        onSignIn={() => void signInAgain()}
      />
    );
  }

  return <OnboardingDone claim={claim} finishing={finishing} onFinish={() => void finish()} />;
}
