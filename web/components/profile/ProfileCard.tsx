'use client';

import { Badge, Card, Text } from '@/components/ui';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { ProfileIntentCard } from './ProfileIntentCard';
import { ProfileLegalCard } from './ProfileLegalCard';
import { useSession } from '@/lib/auth';

/**
 * Account card: who you are, how you got in, and a way out.
 *
 * The sign-out control is not decoration — without it there is no way back to
 * the signed-out state from the UI, which makes the whole sign-in flow
 * untestable without clearing localStorage by hand.
 *
 * Identity fields are shown only when they exist, rather than as a row of
 * "Not set" placeholders: a fresh account legitimately has no phone and no name
 * yet, and inventing a filled-in form for it would misrepresent the account.
 */
export function ProfileCard() {
  const session = useSession();
  const user = session.user;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Text variant="micro" as="p">
          Signed in as
        </Text>
        <Text variant="section" as="p" className="mt-1">
          {name || user?.email || 'Unknown account'}
        </Text>
        {name && user?.email ? (
          <Text variant="micro" as="p" className="mt-1">
            {user.email}
          </Text>
        ) : null}
        {user?.phone ? (
          <Text variant="micro" as="p" className="mt-1">
            {user.phone}
          </Text>
        ) : null}
        <div className="mt-3">
          <Badge variant={session.source === 'privy' ? 'success' : 'neutral'}>
            {session.source === 'privy' ? 'Privy session' : 'Dev session (local only)'}
          </Badge>
        </div>
      </Card>

      <ProfileIntentCard />

      <ProfileLegalCard />

      <Card inset>
        <Text variant="micro" as="p">
          Identity checks, consent history and the deposit sheet are not ported from
          mobile yet.
        </Text>
      </Card>

      <SignOutButton />
    </div>
  );
}
