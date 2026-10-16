'use client';

import { StateMessage, Text } from '@/components/ui';
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
 *
 * The question, its two answers and the note sit ON the page, not in a card. The
 * send flow's identical decision made exactly this call and said why ("the
 * question, the two answers, the field and the Continue control sit directly on
 * the page"), and two questions of the same shape in two different containers is
 * how a person learns that the app is not one thing. The options are objects and
 * keep their own borders; the words are the page's.
 */
export function OnboardingIntent({ pending, busy, error, onChoose }: OnboardingIntentProps) {
  return (
    <div className="flex flex-col gap-4">
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

      <Text variant="micro" as="p" color="secondary">
        {ONBOARDING_COPY.intentReversible}
      </Text>

      {error ? (
        <StateMessage variant="failure" title={ONBOARDING_COPY.intentError} body={error} />
      ) : null}
    </div>
  );
}
