'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui';

/**
 * `/app/pay` → the send flow.
 *
 * Paying a merchant is no longer a separate screen: a merchant is a Seti account
 * whose name resolves as a business, and the send flow mounts the merchant's
 * amount step for exactly that case. This route stays because it is in the world —
 * a merchant's page, a printed QR, a bookmark — and a 404 on the way to paying
 * somebody is a sale nobody can make.
 *
 * `?handle=` is forwarded as `?to=`, so a link that already names the merchant
 * lands on the amount step with the merchant resolved rather than at the flow's
 * first question.
 *
 * A client redirect rather than a config one, because the QUERY has to survive:
 * `next.config.ts` can match a path but cannot carry an arbitrary `?handle=` to a
 * different name on the other side.
 */
export default function PayPage() {
  return (
    <Suspense fallback={<Forwarding />}>
      <ForwardToSend />
    </Suspense>
  );
}

function ForwardToSend() {
  const router = useRouter();
  const params = useSearchParams();
  const to = params.get('handle') ?? params.get('to');

  useEffect(() => {
    router.replace(to ? `/app/send?to=${encodeURIComponent(to)}` : '/app/send');
  }, [router, to]);

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
