'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageBack } from '@/components/app/PageBack';
import { SignInCard } from '@/components/auth/SignInCard';
import { ReceiveAddressPanel } from '@/components/receive/ReceiveAddressPanel';
import { ReceiveNameCard } from '@/components/receive/ReceiveNameCard';
import { RECEIVE_PAGE_COPY } from '@/components/receive/ReceivePage.constants';
import { ReceiveSwitch } from '@/components/receive/ReceiveSwitch';
import { Skeleton, Text } from '@/components/ui';
import { useSession } from '@/lib/auth';
import type { ReceiveView } from '@/components/receive/ReceivePage.types';

/**
 * Receive — `/app/receive`.
 *
 * The one place money arrives, in two halves: BY NAME (another Seti account sends
 * to the handle or the link) and BY ADDRESS (a wallet outside Seti sends to this
 * account's own Tempo address). They were two surfaces — a card on Home and the old
 * `/app/deposit` page — and the pair was a hazard, because the two codes look alike
 * and mean different things: a person could hand out an address when they meant a
 * name, and an address is per-network while a name is not.
 *
 * One page with a switch, so the choice is made once, in words, BEFORE either code
 * is on screen. One code per frame, always — the reason the halves are not two
 * cards stacked on one page.
 *
 * The PAGE carries the framing (title, the switch, the lead sentence) and the cards
 * carry the objects. That is the balance this surface was rebuilt for: the old
 * deposit page put a heading, a paragraph, a code, an address and a button inside
 * one dark well, so the card was a wall to read and the page around it said nothing.
 *
 * The view lives in the URL (`?view=name|address`), and `?view=address` is what the
 * old `/app/deposit` link redirects to — a bookmark or a printed QR pointing at the
 * deposit page still lands on the address rather than resetting to the name half.
 *
 * The `Suspense` boundary is required, not decorative: `useSearchParams` inside a
 * route that is prerendered as static content fails the build without one (the pay
 * page carries the same boundary for the same reason).
 */
export default function ReceivePage() {
  return (
    <Suspense fallback={<ReceiveLoading />}>
      <ReceiveScreen />
    </Suspense>
  );
}

/** This screen's own shape, so the placeholder does not promise another page's layout. */
function ReceiveLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label={RECEIVE_PAGE_COPY.loading}>
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function ReceiveScreen() {
  const session = useSession();
  const view: ReceiveView = useSearchParams().get('view') === 'address' ? 'address' : 'name';

  if (session.status === 'loading') {
    return <ReceiveLoading />;
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
    <div className="flex flex-col gap-4">
      <PageBack />
      <Text variant="section" as="h1">
        {RECEIVE_PAGE_COPY.title}
      </Text>

      <ReceiveSwitch view={view} />

      {view === 'name' ? (
        <>
          <Text variant="body" color="secondary" as="p">
            {RECEIVE_PAGE_COPY.nameLead}
          </Text>
          <ReceiveNameCard />
        </>
      ) : (
        <ReceiveAddressPanel />
      )}
    </div>
  );
}
