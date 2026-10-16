'use client';

import { Button, Text } from '@/components/ui';
import { ClaimForm } from '@/components/merchant/ClaimForm';
import { ONBOARDING_COPY } from './Onboarding.constants';
import type { OnboardingDoneProps } from './Onboarding.types';

/**
 * Step four: done.
 *
 * Two shapes, one step, because "finished onboarding" has two ways to be true:
 *
 *  - a claim has JUST landed in this wizard — and the result is the REAL claim
 *    result, the same component `/app/merchant` shows, which for a business carries
 *    the shareable link and the printable QR. Nothing here re-draws either: a second
 *    rendering of a sticker is a second sticker, and the two drift the moment one
 *    changes.
 *  - the account was ALREADY onboarded when it reached this URL. Then there is
 *    nothing to claim, and offering the name form again would invite a second,
 *    unintended handle. It says so plainly and sends them into the app.
 *
 * The second shape is plain text on the page, not a card. It used to render
 * through `StateMessage`'s neutral shape, which is a bordered, padded surface —
 * a surface drawn around two sentences, with no action and no object in it. The
 * system's own rule is that text lives on the page and only objects get surfaces,
 * and there was nothing here for the surface to hold.
 *
 * The button into the app is a real request, not a link: it re-reads the account
 * (so the gate has the handle it just gained) and only then navigates. A `<Link>`
 * would race the gate and bounce the person back into a wizard they have finished.
 */
export function OnboardingDone({ claim, finishing, onFinish }: OnboardingDoneProps) {
  return (
    <div className="flex flex-col gap-4">
      {claim.claimed ? (
        <ClaimForm claim={claim} />
      ) : (
        <div>
          <Text variant="card-title" as="p">
            {ONBOARDING_COPY.alreadyTitle}
          </Text>
          <Text variant="body" color="secondary" as="p" className="mt-1">
            {ONBOARDING_COPY.alreadyBody}
          </Text>
        </div>
      )}

      <Button onClick={onFinish} loading={finishing} fullWidth>
        {finishing ? ONBOARDING_COPY.finishing : ONBOARDING_COPY.finish}
      </Button>
    </div>
  );
}
