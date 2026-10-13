'use client';

import { ProfileCard } from '@/components/profile/ProfileCard';
import { SignInCard } from '@/components/auth/SignInCard';
import { Skeleton } from '@/components/ui';
import { useSession } from '@/lib/auth';

/**
 * Profile, ported from `mobile/src/app/(tabs)/profile.tsx`.
 *
 * Gated like Home and Pay, and for a concrete reason: ungated, a signed-out
 * visitor gets the account card with a null user — "Unknown account" under a
 * "Privy session" badge, which reads as the sign-out having failed. The badge
 * describes the build's auth source, so it cannot say anything about whether a
 * session exists.
 */
export default function ProfilePage() {
  const session = useSession();

  if (session.status === 'loading') {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!session.isAuthenticated) {
    return (
      <SignInCard
        onSignIn={() => void session.signIn()}
        error={session.error}
        source={session.source}
        pending={session.signingIn}
      />
    );
  }

  return <ProfileCard />;
}
