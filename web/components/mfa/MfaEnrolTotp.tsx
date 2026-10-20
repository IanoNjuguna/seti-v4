'use client';

import { Button, Input, Text } from '@/components/ui';
import { MFA_ENROL_COPY } from '@/lib/mfa/mfa.constants';
import type { MfaEnrolmentValue } from '@/hooks/useMfaEnrolment.types';

/**
 * The authenticator path: the key, then the six digits.
 *
 * The `otpauth://` link is offered as a CONTROL rather than drawn as a QR code. On
 * the phones this is built for it is one tap into the app that will hold the code,
 * and a QR would need a second device to scan it — which is the assumption that
 * disappoints exactly the audience this page is for. The secret stays visible as
 * text underneath, because a desktop browser has no authenticator to open and the
 * person has to type it somewhere.
 *
 * The digits are `tabular` and `one-time-code`, so a phone offers them from the
 * message it just received, and the submit is gated on six being present rather than
 * on a vendor round trip.
 */
export function MfaEnrolTotp({ enrolment }: { enrolment: MfaEnrolmentValue }) {
  if (!enrolment.totp) return null;

  const ready = enrolment.code.trim().length >= 6;

  return (
    <div className="flex flex-col gap-4">
      <Text as="p" variant="body" color="secondary">
        {MFA_ENROL_COPY.totpIntro}
      </Text>

      <a href={enrolment.totp.authUrl} className="underline underline-offset-4">
        <Text as="span" variant="body-medium" color="accent">
          {MFA_ENROL_COPY.totpOpen}
        </Text>
      </a>

      <div className="flex flex-col gap-1">
        <Text as="p" variant="micro" color="secondary">
          {MFA_ENROL_COPY.totpSecretLabel}
        </Text>
        <Text as="p" variant="body" tabular className="break-all">
          {enrolment.totp.secret}
        </Text>
      </div>

      <Input
        label={MFA_ENROL_COPY.codeLabel}
        hint={MFA_ENROL_COPY.codeHint}
        value={enrolment.code}
        onChange={(event) => enrolment.setCode(event.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
      />

      <Button
        variant="primary"
        fullWidth
        onClick={enrolment.submitTotp}
        disabled={!ready || enrolment.busy}
        loading={enrolment.busy}
      >
        {MFA_ENROL_COPY.submit}
      </Button>

      <Button variant="ghost" onClick={enrolment.back} className="self-start">
        {MFA_ENROL_COPY.back}
      </Button>
    </div>
  );
}
