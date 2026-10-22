'use client';

import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { MFA_ENROL_COPY } from '@/lib/mfa/mfa.constants';
import type { MfaEnrolmentValue } from '@/hooks/useMfaEnrolment.types';

/**
 * The choice, and nothing else.
 *
 * Two options, each a row whose whole surface is the tap target, with its reason inside
 * it, so the tap target and the explanation are the same object instead of a label nobody
 * associates with the button under it. Neither is styled as the primary action: neither is
 * the right answer for everybody, and a filled button on one of them would be the page
 * telling the customer they got it wrong by preferring the other.
 *
 * These used to be `Button`s, which is how the content came to overflow its own box: a
 * Button is a fixed 48px with centred text, and a label plus a detail line is taller than
 * that, so on a phone the next row's border was drawn through the first option's detail.
 * `ChoiceRow` grows with its words and keeps them at the left edge.
 *
 * The passkey comes first because it is the one with nothing to remember, and the
 * authenticator is the fallback for a device without a platform authenticator — which is a
 * real case, not a corner one.
 */
export function MfaEnrolChoice({ enrolment }: { enrolment: MfaEnrolmentValue }) {
  return (
    <div className="flex flex-col gap-2">
      <ChoiceRow
        label={MFA_ENROL_COPY.passkey.label}
        detail={MFA_ENROL_COPY.passkey.detail}
        onSelect={enrolment.choosePasskey}
        disabled={enrolment.busy}
      />

      <ChoiceRow
        label={MFA_ENROL_COPY.totp.label}
        detail={MFA_ENROL_COPY.totp.detail}
        onSelect={enrolment.chooseTotp}
        disabled={enrolment.busy}
      />
    </div>
  );
}
