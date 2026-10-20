'use client';

import { Button, Text } from '@/components/ui';
import { MFA_ENROL_COPY } from '@/lib/mfa/mfa.constants';
import type { MfaEnrolmentValue } from '@/hooks/useMfaEnrolment.types';

/**
 * The choice, and nothing else.
 *
 * Two options, each a full-width control with its reason inside it, so the tap
 * target and the explanation are the same object instead of a label nobody
 * associates with the button under it. Both are `secondary`: neither is the right
 * answer for everybody, and a primary button on one of them would be the page
 * telling the customer they got it wrong by preferring the other.
 *
 * The passkey comes first because it is the one with nothing to remember, and the
 * authenticator is the fallback for a device without a platform authenticator —
 * which is a real case, not a corner one.
 */
export function MfaEnrolChoice({ enrolment }: { enrolment: MfaEnrolmentValue }) {
  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" fullWidth onClick={enrolment.choosePasskey} disabled={enrolment.busy}>
        <span className="flex flex-col items-start gap-1 text-left">
          <Text as="span" variant="button">
            {MFA_ENROL_COPY.passkey.label}
          </Text>
          <Text as="span" variant="micro" color="secondary">
            {MFA_ENROL_COPY.passkey.detail}
          </Text>
        </span>
      </Button>

      <Button variant="secondary" fullWidth onClick={enrolment.chooseTotp} disabled={enrolment.busy}>
        <span className="flex flex-col items-start gap-1 text-left">
          <Text as="span" variant="button">
            {MFA_ENROL_COPY.totp.label}
          </Text>
          <Text as="span" variant="micro" color="secondary">
            {MFA_ENROL_COPY.totp.detail}
          </Text>
        </span>
      </Button>
    </div>
  );
}
