import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Text } from '@/components/ui';
import { PAY_COPY } from '@/components/pay-public/PayPublic.constants';
import { PayPublicView } from '@/components/pay-public/PayPublicView';
import { PayRefusal } from '@/components/pay-public/PayRefusal';
import { loadCharge } from '@/lib/charges/load-charge';

interface PayChargePageProps {
  params: Promise<{ id: string }>;
}

/**
 * `seti.live/pay/<id>` — one payment request, as a public page.
 *
 * UNAUTHENTICATED, deliberately, and this is the whole point of the feature: a link
 * pasted into WhatsApp has to be readable by someone with no app, no account and no
 * JavaScript. So this is a server component with no session gate, no cookie, and no
 * client state; the charge, the recipient and the status are all resolved before the
 * first byte, and the page is identical for a browser and for `curl`.
 *
 * Loaded through `load-charge.ts`, which is the ONE seam a real charge source plug into
 * (#131). Nothing else in this file knows where a charge comes from.
 *
 * `no-store` by way of `force-dynamic`: expiry and payment state are decided on the
 * server at request time, so a cached 200 would keep offering a code for a request that
 * has already been paid or has run out.
 *
 * An id that names no charge is a real 404 (`notFound()`), which is how a mistyped link
 * reads. A charge whose signature does not hold is NOT a 404 — it is the page's own
 * refusal, because "there is nothing here" would be a different (and untrue) statement
 * about a request that does exist and must not be paid.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Payment request — Seti',
  // A payment request is not a document for a search engine: indexed, one person's
  // request becomes a public page anyone can be pointed at.
  robots: { index: false, follow: false, nocache: true },
};

export default async function PayChargePage({ params }: PayChargePageProps) {
  const { id } = await params;
  const result = await loadCharge(id);

  if (result.kind === 'not-found') notFound();

  return (
    <main className="min-h-dvh bg-canvas-light text-ink">
      <div className="mx-auto w-full max-w-md px-5 py-10">
        {/* The wordmark belongs to the PAGE, not to the charge: a refusal has to say
            who is refusing, or a stranger cannot tell it from a broken link. */}
        <div className="space-y-6">
          <Text variant="micro" as="p" color="primary" className="font-brand text-heading-sm">
            {PAY_COPY.brand}
          </Text>

          {result.kind === 'invalid' ? (
            <PayRefusal />
          ) : (
            <PayPublicView charge={result.charge} payee={result.payee} status={result.status} />
          )}
        </div>
      </div>
    </main>
  );
}
