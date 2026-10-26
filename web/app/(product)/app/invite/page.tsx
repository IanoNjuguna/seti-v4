'use client';

import { PageBack } from '@/components/app/PageBack';
import { SignInCard } from '@/components/auth/SignInCard';
import { InviteScreen } from '@/components/invite/InviteScreen';
import { Skeleton } from '@/components/ui';
import { INVITE_COPY } from '@/components/invite/Invite.constants';
import { useSession } from '@/lib/auth';

/**
 * Invite friends — `/app/invite`.
 *
 * The front door for a growth loop that already exists in the data: the link is
 * `seti.live/i/<handle>`, and who arrived on it is counted when they sign up
 * (#145). The screen only states what happened; it promises nothing, because there
 * is no reward in this version.
 *
 * Signed out, the page is the app's own sign-in card rather than an invite with no
 * account behind it: a visitor has no link to hand out, and showing them a skeleton
 * where one would be is a screen that never resolves.
 */
export default function InvitePage() {
  const session = useSession();

  if (session.status === 'restoring') return <InvitePageLoading />;
  if (!session.isAuthenticated) return <SignInCard error={session.error} />;

  return (
    <div className="flex flex-col gap-4">
      <PageBack />
      <InviteScreen />
    </div>
  );
}

/** The page's own shape, before the session is known. */
function InvitePageLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label={INVITE_COPY.loading}>
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-5 w-full max-w-md" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
