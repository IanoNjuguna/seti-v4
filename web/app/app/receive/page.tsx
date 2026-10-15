'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageBack } from '@/components/app/PageBack';
import { SignInCard } from '@/components/auth/SignInCard';
import { useAccountIdentity } from '@/lib/account';
import { ReceiveAddressPanel } from '@/components/receive/ReceiveAddressPanel';
import { ReceiveMerchantHalf } from '@/components/receive/ReceiveMerchantHalf';
import { ReceiveNameHalf } from '@/components/receive/ReceiveNameHalf';
import { RECEIVE_PAGE_COPY } from '@/components/receive/ReceivePage.constants';
import { ReceiveSwitch } from '@/components/receive/ReceiveSwitch';
import { Skeleton, Text } from '@/components/ui';
import { useSession } from '@/lib/auth';
import type { ReceiveView } from '@/components/receive/ReceivePage.types';

/**
 * Receive — `/app/receive`.
 *
 * The one place money arrives, in halves: BY NAME (another Seti account sends to
 * the username or the link), BY ADDRESS (a wallet outside Seti sends to this
 * account's own Tempo address), and BY MERCHANT NAME once the account holds a
 * business name (a customer pays that name). They were separate surfaces — a card
 * on Home and the old `/app/deposit` page — and the set was a hazard, because the
 * codes look alike and mean different things: a person could hand out an address
 * when they meant a name, and an address is per-network while a name is not.
 *
 * One page with a switch, so the choice is made once, in words, BEFORE any code is
 * on screen. One code per frame, always — the reason the halves are not three cards
 * stacked on one page.
 *
 * The PAGE carries every word: the title, the lead sentence for the half that is
 * showing, the switch, and the chain line under the address. The halves carry the
 * objects. There are no cards left here on purpose — a card that carries its own
 * explanation and then sits under a heading that says the same thing is how this
 * surface ended up with four lines of prose around one code.
 *
 * The view lives in the URL (`?view=name|address|merchant`), and `?view=address` is
 * what the old `/app/deposit` link redirects to — a bookmark or a printed QR
 * pointing at the deposit page still lands on the address rather than resetting to
 * the username half. A view the account cannot offer (a merchant name it does not
 * hold) falls back to the username half rather than rendering a tab with nothing
 * behind it.
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

/** This screen's own shape: back, title, the line that tells you which half to use, the switch, then the half. */
function ReceiveLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label={RECEIVE_PAGE_COPY.loading}>
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-6 w-44" />
      <Skeleton className="h-5 w-full max-w-md" />
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function ReceiveScreen() {
  const session = useSession();
  const { identity, loading: identityLoading } = useAccountIdentity();
  const requested = useSearchParams().get('view');

  if (session.status === 'loading' || identityLoading) {
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

  const business = identity?.handles.find((candidate) => candidate.kind === 'business');
  const views: ReceiveView[] = business ? ['name', 'address', 'merchant'] : ['name', 'address'];
  const view: ReceiveView = views.find((option) => option === requested) ?? 'name';

  return (
    <div className="flex flex-col gap-4">
      <PageBack />
      <Text variant="section" as="h1">
        {RECEIVE_PAGE_COPY.title}
      </Text>
      <Text variant="body" color="secondary" as="p">
        {RECEIVE_PAGE_COPY.lead}
      </Text>

      <ReceiveSwitch view={view} views={views} />

      {view === 'address' ? (
        <ReceiveAddressPanel />
      ) : (
        <>
          <Text variant="body" color="secondary" as="p">
            {view === 'merchant' ? RECEIVE_PAGE_COPY.merchantLead : RECEIVE_PAGE_COPY.nameLead}
          </Text>
          {view === 'merchant' && business ? (
            <ReceiveMerchantHalf name={business.name} handle={business.handle} />
          ) : (
            <ReceiveNameHalf />
          )}
        </>
      )}
    </div>
  );
}
