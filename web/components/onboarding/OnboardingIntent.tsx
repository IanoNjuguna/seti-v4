'use client';

import { Card, StateMessage, Text } from '@/components/ui';
import { INTENT_OPTIONS, ONBOARDING_COPY } from './Onboarding.constants';
import { IntentOption } from './IntentOption';
import type { OnboardingIntentProps } from './Onboarding.types';

/**
 * Step three: personal or business.
 *
 * This is the step that signs. The choice decides the handle's `kind`, the kind
 * decides the `purpose` inside the signed bytes, and the backend refuses a
 * signature made for the other purpose — so asking for the signature here, after
 * the choice, is what makes the purpose unambiguous rather than a guess.
 *
 * A refusal from the previous attempt is shown HERE rather than back on the name
 * field: a name that was taken while the wallet was open is not the person's
 * mistake, and sending them back to rewrite a name that was fine is the wrong fix.
 */
export function OnboardingIntent({ pending, busy, error, onChoose }: OnboardingIntentProps) {
  return (
    <Card className="space-y-4">
      <div>
        <Text variant="section" as="h2">
          {ONBOARDING_COPY.intentTitle}
        </Text>
        <Text variant="body" color="secondary" as="p" className="mt-1">
          {ONBOARDING_COPY.intentIntro}
        </Text>
      </div>

      <div className="flex flex-col gap-3">
        {INTENT_OPTIONS.map((option) => (
          <IntentOption
            key={option.intent}
            intent={option.intent}
            title={option.title}
            body={option.body}
            action={option.action}
            pending={pending}
            busy={busy}
            onChoose={onChoose}
          />
        ))}
      </div>

      <Text variant="micro" as="p">
        {ONBOARDING_COPY.intentReversible}
      </Text>

      {error ? (
        <StateMessage tone="alert" title={ONBOARDING_COPY.intentError} body={error} />
      ) : null}
    </Card>
  );
}
