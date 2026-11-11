'use client';

import { PersonalDetailsScreen } from '@/components/profile/personal/PersonalDetailsScreen';
import { ProfileLoading } from '@/components/profile/ProfileLoading';
import { ProfileSignedOut } from '@/components/profile/ProfileSignedOut';
import { useSession } from '@/lib/auth';

/**
 * Personal information, at `/app/profile/personal`.
 *
 * The same three-way branch the profile page makes, and for the same reason: a stored session
 * still being re-resolved gets the skeleton, and everybody else gets one sentence and the way
 * in. `/app`'s own gate has already decided whether an account is onboarded; this page only
 * decides whether there is a person to draw.
 */
export default function PersonalDetailsPage() {
  const session = useSession();

  if (session.status === 'restoring') {
    return <ProfileLoading />;
  }

  return session.status === 'signed-in' ? <PersonalDetailsScreen /> : <ProfileSignedOut />;
}
