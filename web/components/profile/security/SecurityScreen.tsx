'use client';

import { Text } from '@/components/ui';
import { MfaEnrolPanel } from '@/components/mfa/MfaEnrolPanel';
import { ProfileSection } from '../ProfileSection';
import { SECURITY_COPY, SIGN_IN_METHOD_COPY } from './SecurityScreen.constants';
import { useSecurity } from './useSecurity';

/**
 * What protects the account, stated as fact rather than as reassurance.
 *
 * Four rows, in the order a person worries: how I get in, whether that is enough, who
 * holds the key, and where else I am signed in. The last one says we do not know,
 * because there is no session table to read: a fake device list would be worse than
 * the gap, and the gap is the honest thing to show.
 */
export function SecurityScreen() {
  const security = useSecurity();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Text variant="section" as="h1">
          {SECURITY_COPY.title}
        </Text>
        <Text variant="micro" as="p" color="secondary" className="mt-1">
          {SECURITY_COPY.intro}
        </Text>
      </header>

      <ProfileSection title={SECURITY_COPY.signIn.title}>
        <Text variant="body" as="p">
          {security.signIn === 'unknown'
            ? SECURITY_COPY.signIn.unknown
            : `${SECURITY_COPY.signIn.body} ${SIGN_IN_METHOD_COPY[security.signIn]}.`}
        </Text>
      </ProfileSection>

      <ProfileSection
        title={SECURITY_COPY.secondFactor.title}
        intro={security.hasSecondFactor ? undefined : SECURITY_COPY.secondFactor.none}
      >
        {security.hasSecondFactor ? (
          <div className="flex flex-col gap-2">
            <Text variant="body" as="p">
              {security.methodCount > 1
                ? SECURITY_COPY.secondFactor.enrolledMany
                : SECURITY_COPY.secondFactor.enrolledOne}
            </Text>
            <Text variant="micro" as="p" color="secondary">
              {SECURITY_COPY.secondFactor.cannotRemove}
            </Text>
          </div>
        ) : (
          <MfaEnrolPanel onEnrolled={() => undefined} />
        )}
      </ProfileSection>

      <ProfileSection title={SECURITY_COPY.keys.title}>
        <Text variant="body" as="p">
          {SECURITY_COPY.keys.body}
        </Text>
      </ProfileSection>

      <ProfileSection title={SECURITY_COPY.devices.title}>
        <Text variant="body" as="p">
          {SECURITY_COPY.devices.body}
        </Text>
      </ProfileSection>
    </div>
  );
}
