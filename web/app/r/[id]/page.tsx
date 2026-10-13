import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReceiptPublicView } from '@/components/receipt-public/ReceiptPublicView';
import { fetchPublicReceipt } from '@/lib/api/receipt-public';

interface SharedReceiptPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}

/**
 * `seti.live/r/<opaqueId>?t=<token>` — the receipt as its own shareable page.
 *
 * This is a plain path, not `/@x`: in the App Router `@x` is a parallel-route
 * SLOT, not a URL, and a receipt behind an owner-only session defeats the point
 * of sharing it.
 *
 * UNAUTHENTICATED, deliberately: a server component with no session gate, and the
 * read comes from `/receipts/:id`, which has no auth hook either. The capability
 * is the signed token in `?t=`. An unknown id, a missing token, a forged one and
 * an expired one are indistinguishable — the backend 404s all of them — and the
 * page turns that single answer into `notFound()`, so it can never be used to
 * test whether a guessed id exists.
 *
 * The read is uncached (`no-store`), because expiry is enforced server-side and a
 * cached 200 would outlive the capability.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Receipt — Seti',
  // A shared link is a capability, not content: it must never become a search
  // result, or handing it to one merchant would publish it to everyone.
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedReceiptPage({ params, searchParams }: SharedReceiptPageProps) {
  const { id } = await params;
  const { t } = await searchParams;
  const token = typeof t === 'string' ? t : '';

  const receipt = await fetchPublicReceipt(id, token);

  if (!receipt) notFound();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas-light px-5 py-10">
      <div className="w-full max-w-md">
        <ReceiptPublicView receipt={receipt} receiptId={id} token={token} />
      </div>
    </main>
  );
}
