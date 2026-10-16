'use client';

import { ProfileScreen } from '@/components/profile/ProfileScreen';
import { ProfileSignedOut } from '@/components/profile/ProfileSignedOut';
import { PROFILE_PAGE_COPY } from '@/components/profile/ProfilePage.constants';
import { Skeleton, Text } from '@/components/ui';
import { useSession } from '@/lib/auth';

/**
 * Profile — `/app/profile`.
 *
 * The page owns its own TITLE and nothing else: the rows below it are
 * `ProfileScreen` when the server confirmed an account, and `ProfileSignedOut` for
 * everybody else, which keeps the page's shape with one sentence where each fact
 * would be. Branching here rather than inside the rows is what makes the title one
 * line in one place — every state of the page wears it, including the first paint
 * while a stored session is being re-resolved.
 *
 * The title is `section` at page level, the same treatment `/app/send` and
 * `/app/receive` give theirs, and the `restoring` branch is deliberately the shared
 * skeleton rather than a second loading state: a visitor must be able to look at the
 * product before anything is asked of them, and the identity below the title is
 * resolved by the rows, not here.
 *
 * The page's TITLE does not state who you are signed in as — that line belongs to
 * the rows below (`ProfileScreen`, under "How you use Seti"), which is now its
 * one home. The rail deliberately does not state it either: it used to, and the
 * same fact in two places is one fact said twice on one screen.
 */
export default function ProfilePage() {
  const session = useSession();

  return (
    <div className="flex flex-col gap-6">
      <Text variant="section" as="h1">
        {PROFILE_PAGE_COPY.title}
      </Text>

      {session.status === 'restoring' ? (
        <Skeleton className="h-40 w-full" />
      ) : session.status === 'signed-in' ? (
        <ProfileScreen />
      ) : (
        <ProfileSignedOut view={session.status} />
      )}
    </div>
  );
}
