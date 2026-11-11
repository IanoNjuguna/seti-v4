'use client';

import { ProfileLoading } from '@/components/profile/ProfileLoading';
import { ProfileScreen } from '@/components/profile/ProfileScreen';
import { ProfileSignedOut } from '@/components/profile/ProfileSignedOut';
import { useSession } from '@/lib/auth';

/**
 * Profile, at `/app/profile`.
 *
 * The page is a branch and nothing else: an account confirmed by the server gets
 * `ProfileScreen`, a stored session still being re-resolved gets the skeleton, and
 * everybody else gets one sentence and the way in.
 *
 * There is no page title here any more, and that is the change this route was
 * filed for. The page opens on the person (`ProfileIdentity`, which is the `h1`),
 * so a noun over the top would be the app introducing the customer to themselves.
 * A VISITOR is the exception: with no person to open on, `ProfileSignedOut` draws the
 * page's name as the `h1` (#562), because a document with no heading at all is a
 * screen a screen reader cannot name.
 * The branch stays at page level because it is what decides whether there is a
 * person to draw at all.
 */
export default function ProfilePage() {
  const session = useSession();

  if (session.status === 'restoring') {
    return <ProfileLoading />;
  }

  return session.status === 'signed-in' ? <ProfileScreen /> : <ProfileSignedOut />;
}
