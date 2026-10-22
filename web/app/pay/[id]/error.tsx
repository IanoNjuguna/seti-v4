'use client';

import { Card, Text } from '@/components/ui';

interface PayChargeErrorProps {
  error: Error & { digest?: string };
  /** This version calls it `retry` (16.3): re-fetches, then re-renders. */
  retry: () => void;
}

/**
 * What a payer sees when the charge could not be read at all.
 *
 * A separate state from the refusal on purpose. This is "we could not load this", which
 * is our failure and is worth retrying; "this request is not valid" is the request's
 * failure and is not. Collapsing them would either invite a retry on a forged request
 * or tell a payer their link is invalid because our backend blinked.
 *
 * Nothing about the payer is logged or reported here — no address, no user agent, no
 * identifier. A payment page that records who opened it is a payment page that knows
 * something it was never told.
 */
export default function PayChargeError({ retry }: PayChargeErrorProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas-light px-5 py-10">
      <div className="w-full max-w-md">
        <Card className="space-y-3">
          <Text variant="section" as="h1">
            Could not load this request
          </Text>

          <Text variant="body" color="secondary" as="p">
            Something went wrong on our side. Nothing has been charged, and this link is
            unchanged — try it again in a moment.
          </Text>

          <button
            type="button"
            onClick={retry}
            className="inline-flex min-touch rounded-sm text-body-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light"
          >
            Try again
          </button>
        </Card>
      </div>
    </main>
  );
}
