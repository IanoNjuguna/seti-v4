'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MerchantClaimScreen } from '@/components/merchant/MerchantClaimScreen';
import { Skeleton } from '@/components/ui';
import type { HandleKind } from '@/lib/api';

/**
 * Claim a name — `/app/merchant`.
 *
 * A route of its own rather than a fifth tab: the tab bar mirrors the mobile app's
 * four destinations exactly, and claiming is something a person does once, not a
 * place they live. It is linked from Profile.
 *
 * `?kind=` exists so the SAME surface serves both sides of the intent: Profile's
 * personal side sends `?kind=person` and its business side sends nothing, so a person
 * who onboarded as a business can still claim a username — the reverse of "try it
 * personal, add a business later", and the reason the intent is not a one-way door.
 *
 * The kind is read from the LIVE URL with `useSearchParams`, NOT from the page's
 * `searchParams` prop. This route is prerendered as static content, so that prop is
 * resolved once at build time and arrives EMPTY: the first version of this read it,
 * and a `?kind=person` link silently claimed a BUSINESS name instead — a wrong
 * purpose and a wrong link, with no error anywhere. `useSearchParams` reads the
 * browser's own URL, which is why the boundary below is required: it client-renders
 * the subtree that depends on the query while the rest of the route stays static.
 */
function KindFromUrl() {
  const kind: HandleKind = useSearchParams().get('kind') === 'person' ? 'person' : 'business';

  // `key` remounts the screen when the kind changes, because the claim hook takes its
  // initial kind once at mount and would otherwise keep the kind of the URL the
  // person arrived from.
  return <MerchantClaimScreen key={kind} kind={kind} />;
}

export default function MerchantClaimPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <KindFromUrl />
    </Suspense>
  );
}
