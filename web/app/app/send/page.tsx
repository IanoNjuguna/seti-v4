'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SendLoading } from '@/components/send/SendLoading';
import { SendScreen } from '@/components/send/SendScreen';

/**
 * Send — `/app/send`, and the ONE way money leaves the account.
 *
 * The route's whole body is the query and the boundary: `SendScreen` owns whether
 * there is an account, and `SendFlow` owns the flow. Paying a MERCHANT is not a
 * separate flow any more — a merchant is a Seti account whose name resolved as a
 * business, so `/app/pay` forwards here and the resolved kind decides which amount
 * step is mounted.
 *
 * The query is read with `useSearchParams` — the LIVE URL — never the page's
 * `searchParams` prop: this route is prerendered as static content, so that prop
 * resolves once at build time and arrives EMPTY, which left a person's public link
 * resolving nobody in a production build. Reading the live URL is also why the
 * `Suspense` boundary below is required rather than decorative: it lets the
 * subtree that depends on the query client-render while the rest of the route
 * stays static (the receive and merchant pages carry the same boundary for the
 * same reason).
 */
export default function SendPage() {
  return (
    <Suspense fallback={<SendLoading />}>
      <SendFromUrl />
    </Suspense>
  );
}

/**
 * `?to=` (and `?handle=`, the old pay link) name the recipient; nothing is asked
 * twice. The value is passed down verbatim — the same string a typed handle would
 * be, resolved through the same path — and the flow decides what it is.
 */
function SendFromUrl() {
  const params = useSearchParams();
  const linked = params.get('to') ?? params.get('handle') ?? null;

  return <SendScreen linked={linked} />;
}
