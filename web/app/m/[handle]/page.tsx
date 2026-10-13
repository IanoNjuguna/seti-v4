import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { MerchantPublicView } from '@/components/merchant-public/MerchantPublicView';
import { fetchPublicMerchant } from '@/lib/api/merchant-public';

interface MerchantLinkPageProps {
  params: Promise<{ handle: string }>;
}

/**
 * `seti.live/m/<handle>` — the page a printed sticker opens.
 *
 * UNAUTHENTICATED, deliberately: it is a server component with no session gate,
 * and the identity comes from `/public/merchants/:handle`, which has no auth hook
 * either. A stranger scanning a code must see who they are paying before being
 * asked for anything.
 *
 * An unknown handle is a real 404 (`notFound()`), never an empty page — a link
 * that resolves to nothing has to say so. The read is uncached (`no-store`, see
 * `fetchPublicMerchant`), so a name claimed or an address repointed a moment ago
 * is what the customer sees.
 */
const loadMerchant = cache(fetchPublicMerchant);

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: MerchantLinkPageProps): Promise<Metadata> {
  const { handle } = await params;
  const merchant = await loadMerchant(handle);

  return merchant
    ? { title: `${merchant.name} — Seti`, description: `Pay ${merchant.name} with Seti.` }
    : { title: 'Merchant not found — Seti' };
}

export default async function MerchantLinkPage({ params }: MerchantLinkPageProps) {
  const { handle } = await params;
  const merchant = await loadMerchant(handle);

  if (!merchant) notFound();

  return (
    <main className="min-h-dvh bg-canvas-light text-ink">
      <div className="mx-auto w-full max-w-md px-5 py-10">
        <MerchantPublicView merchant={merchant} />
      </div>
    </main>
  );
}
