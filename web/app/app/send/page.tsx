'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
 * linked, bookmarked and reloaded.
 *
 * `?to=` is the one automatic entry: a `seti.live/u/<handle>` page's Send action
 * sends the handle here, and it is resolved through the SAME path a typed handle
 * takes — the server answers with a name AND an address, and the ADDRESS is what
 * gets signed.
 *
 * The handle comes from `useSearchParams` — the LIVE URL — and not from the page's
 * `searchParams` prop: this route is prerendered as static content, so that prop is
 * resolved once at build time and arrives EMPTY, which left a person's public link
 * resolving nobody in a production build. The boundary below is what makes the
 * query-dependent subtree client-render while the rest stays static.
 *
 * Gated like Home and Activity, in the same three states and the same order, so
 * the app cannot disagree with itself about what "signed in" looks like.
 */
export default function SendPage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <SendScreen />
    </Suspense>
  );
}

function SendScreen() {
  const to = useSearchParams().get('to') ?? undefined;
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
      <SendPanel initialRecipient={to} />
    </div>
  );
}
