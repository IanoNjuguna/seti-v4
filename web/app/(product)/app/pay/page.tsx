'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton, StateMessage } from '@/components/ui';
import { CLAIM_NOT_FOUND, claimRoute, type ClaimReadable } from '@/components/ask/claimRoute';
import { readAsk } from '@/lib/api/requests';

/**
 * `/app/pay` → the send flow, or the answer a claim link earns (#447).
 *
 * Paying a merchant is no longer a separate screen: a merchant is a Seti account
 * whose name resolves as a business, and the send flow mounts the merchant's
 * amount step for exactly that case. This route stays because it is in the world — a
 * merchant's page, a printed QR, a bookmark — and a 404 on the way to paying
 * somebody is a sale nobody can make.
 *
 * `?handle=` and `?to=` are forwarded as `to`, so a link that already names the
 * merchant lands on the amount step with the merchant resolved rather than at the
 * flow's first question.
 *
 * `?ask=` is different in kind. It names a CLAIM, and the claim decides whether
 * there is anything to pay at all, so it is read first — from the same public
 * endpoint the payer's link uses — and only an `open` claim reaches the send flow.
 * A paid, withdrawn or lapsed one gets its own sentence instead of a payment form
 * whose settle could only refuse it.
 *
 * A client redirect rather than a config one, because the QUERY has to survive:
 * `next.config.ts` can match a path but cannot carry an arbitrary `?handle=` to a
 * different name on the other side.
 */
export default function PayPage() {
  return (
    <Suspense fallback={<Forwarding />}>
      <FromQuery />
    </Suspense>
  );
}

function FromQuery() {
  const router = useRouter();
  const params = useSearchParams();
  const claimId = params.get('ask');
  const to = params.get('handle') ?? params.get('to');

  const [answer, setAnswer] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!claimId) {
      router.replace(to ? `/app/send?to=${encodeURIComponent(to)}` : '/app/send');
      return;
    }

    let live = true;

    readAsk(claimId)
      .then(({ request }) => {
        if (!live) return;
        const route = claimRoute(request as ClaimReadable);
        if (route.kind === 'forward') router.replace(route.href);
        else setAnswer({ title: route.title, body: route.body });
      })
      .catch(() => {
        // An unknown id and a broken one read the same: the payer is told the link
        // does not work, and the id is never used to tell the two apart.
        if (live) setAnswer(CLAIM_NOT_FOUND);
      });

    return () => {
      live = false;
    };
  }, [claimId, to, router]);

  if (answer) return <StateMessage variant="failure" title={answer.title} body={answer.body} />;

  return <Forwarding />;
}

/** The shape of every state this route has: it is leaving. */
function Forwarding() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Opening the send flow">
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
