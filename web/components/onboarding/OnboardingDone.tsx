'use client';

import { Button, StateMessage } from '@/components/ui';
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
        <StateMessage title={ONBOARDING_COPY.alreadyTitle} body={ONBOARDING_COPY.alreadyBody} />
      )}

      <Button onClick={onFinish} loading={finishing} fullWidth>
        {finishing ? ONBOARDING_COPY.finishing : ONBOARDING_COPY.finish}
      </Button>
    </div>
  );
}
