'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SendLoading } from '@/components/send/SendLoading';
import { StateMessage } from '@/components/ui';
import { claimAnswer } from '@/components/ask/claim-lines';
import { SendScreen } from '@/components/send/SendScreen';
import { useClaimSeed } from '@/components/send/useClaimSeed';
import { sendSeed } from '@/components/send/sendSeed';

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
 *
 * The seed is read through `sendSeed`, which is a WHITELIST: it takes the payee and
 * nothing else, so `?amount=` on a send link is dropped rather than filled in. That
 * is what makes "the amount is empty until the customer types it" structural on this
 * route instead of a promise about the code (#99).
 */
function SendFromUrl() {
  const params = useSearchParams();
  const { linked, claim } = sendSeed(params);
  const claimSeed = useClaimSeed(claim);

  if (claimSeed.loading) return <SendLoading />;

  /*
   * A claim that cannot be paid says so, and says nothing else: no payee field, no amount, no path
   * forward. A bare `?claim=` that resolves to nothing falls through to the ordinary flow instead,
   * because a dead id in a shared URL must not take the send screen away from somebody who wanted to
   * pay a person (#99).
   */
  const answer = claimSeed.state === 'unknown' ? null : claimAnswer(claimSeed.state);
  if (answer) return <StateMessage variant="failure" title={answer.title} body={answer.body} />;

  /**
   * A claim names both the payee and the figure, and the figure is the ONLY thing a URL is not
   * allowed to seed — which is why it arrives here resolved from the record rather than from the
   * query (#99, #465).
   */
  return <SendScreen linked={claimSeed.seed?.destinationHandle ?? linked} claim={claimSeed.seed} />;
}
