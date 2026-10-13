'use client';

import { PageBack } from '@/components/app/PageBack';
import { SignInCard } from '@/components/auth/SignInCard';
import { HomeLoading } from '@/components/home/HomeLoading';
import { SendPanel } from '@/components/home/SendPanel';
import { useSession } from '@/lib/auth';

/**
 * Send — `/app/send`.
 *
 * Send to a person, in full: the form, the quoted 2% fee, the signed transfer and
 * its receipt. A route of its own rather than an in-card panel, so it can be
 * linked, bookmarked and reloaded, and so the balance card is one thing instead of
 * a page. It is a sibling of the Home tab, not a tab itself, so it carries a Back
 * control.
 *
 * Gated like Home and Activity, in the same three states and the same order, so
 * the app cannot disagree with itself about what "signed in" looks like.
 */
export default function SendPage() {
  const session = useSession();

  if (session.status === 'loading') {
    return <HomeLoading />;
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

  return (
    <div className="flex flex-col gap-5">
      <PageBack />
      <SendPanel />
    </div>
  );
}
