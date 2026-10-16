'use client';

import { Button, StateMessage, Text } from '@/components/ui';
import { useAccountIdentity } from '@/lib/account';
import { OnboardingBody } from './OnboardingBody';
import { OnboardingSteps } from './OnboardingSteps';
import { ONBOARDING_COPY } from './Onboarding.constants';
import { useOnboarding } from './useOnboarding';

/**
 * Onboarding — `/app/onboarding`, the four steps.
 *
 * Sign in → claim a name → choose the intent (which signs) → done.
 *
 * Rendered BARE by the gate (no rail, no tab bar): there is nothing in the app to
 * navigate to until a handle exists. The gate guarantees this component is only
 * reached once the session and the handles are resolved, so there is no loading
 * branch here — the alternative is a second, subtly different loading state.
 *
 * There is deliberately no date of birth field, and adding one would be a
 * regression: the owner removed it. A self-declared tick of the terms — given at
 * `/signin`, where the control that takes it stays `disabled` until it is ticked,
 * by mouse, Enter or Space — carries the same weight at zero PII, and the age gate
 * belongs at the restricted product when one exists, not at a name.
 */
export function Onboarding() {
  const account = useAccountIdentity();
  const wizard = useOnboarding();

  return (
    <div className="min-h-dvh bg-canvas-light text-ink">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pt-6 pb-16">
        <header className="flex flex-col gap-3">
          <OnboardingSteps current={wizard.step} />
          <div>
            <Text variant="section" as="h1">
              {ONBOARDING_COPY.title}
            </Text>
            <Text variant="body" color="secondary" as="p" className="mt-1">
              {ONBOARDING_COPY.intro}
            </Text>
          </div>
        </header>

        {account.error ? (
          // The handles could not be read, so the account's state is unknown. Say so
          // and let the person retry rather than showing a wizard whose first action
          // would fail.
          <StateMessage
            variant="failure"
            title={ONBOARDING_COPY.accountErrorTitle}
            body={account.error}
            action={<Button onClick={account.refresh}>{ONBOARDING_COPY.retry}</Button>}
          />
        ) : (
          <OnboardingBody wizard={wizard} />
        )}
      </main>
    </div>
  );
}
