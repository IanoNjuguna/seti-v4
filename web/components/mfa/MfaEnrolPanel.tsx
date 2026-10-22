'use client';

import { Text } from '@/components/ui';
import { MFA_ENROL_COPY } from '@/lib/mfa/mfa.constants';
import { useMfaEnrolment } from '@/hooks/useMfaEnrolment';
import { MfaEnrolChoice } from './MfaEnrolChoice';
import { MfaEnrolTotp } from './MfaEnrolTotp';
import type { MfaEnrolPanelProps } from './MfaEnrolPanel.types';

/**
 * The screen a customer meets instead of the money step, once — the first time an
 * account with no second factor tries to move funds.
 *
 * It stands in for the step rather than sitting over it as a modal. A modal invites
 * dismissal, and dismissing this one has to mean "no send"; a replaced step says the
 * same thing by simply not being there, and the back control is the flow's own, so
 * there is never a second way out to reason about.
 *
 * Left-aligned, one column, no illustration: this is the moment the product asks for
 * something, and a friendly picture here reads as a detour rather than a request.
 */
export function MfaEnrolPanel({ onEnrolled, embedded = false }: MfaEnrolPanelProps) {
  const enrolment = useMfaEnrolment(onEnrolled);

  return (
    <div className="flex flex-col gap-6">
      {embedded ? null : (
        <div className="flex flex-col gap-2">
          <Text as="h2" variant="section">
            {MFA_ENROL_COPY.title}
          </Text>
          <Text as="p" variant="body" color="secondary">
            {MFA_ENROL_COPY.body}
          </Text>
        </div>
      )}

      {enrolment.step === 'totp' ? (
        <MfaEnrolTotp enrolment={enrolment} />
      ) : (
        <MfaEnrolChoice enrolment={enrolment} />
      )}

      {enrolment.busy && enrolment.step !== 'totp' ? (
        <Text as="p" variant="body" color="secondary" role="status">
          {MFA_ENROL_COPY.passkeyWaiting}
        </Text>
      ) : null}

      {enrolment.error ? (
        <Text as="p" variant="micro" color="alert" role="alert">
          {enrolment.error}
        </Text>
      ) : null}
    </div>
  );
}
