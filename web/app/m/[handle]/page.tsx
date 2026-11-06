import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { MerchantPublicView } from '@/components/merchant-public/MerchantPublicView';
import { fetchPublicHandle } from '@/lib/api/handles';

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
 * `fetchPublicHandle`), so a name claimed or an address repointed a moment ago
 * is what the customer sees.
 */
const loadMerchant = cache(fetchPublicHandle);

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: MerchantLinkPageProps): Promise<Metadata> {
  const { handle } = await params;
  const merchant = await loadMerchant(handle);

  /*
   * NOT CONTENT TO BE FOUND (#346). A merchant's link page exists to be opened from a
   * sticker or a shared link, and it is one sentence of template with a name substituted:
   * thin, per-merchant, and near-identical to every other one. `app/sitemap.ts` already
   * refuses to publish a list of these, and `/u/[handle]` excludes the person side of the
   * same namespace, so indexing the shop side would undo that decision by a slower route.
   * A merchant who later wants to rank on their own name needs a real page, not this one.
   */
  const robots = { index: false, follow: false };

  return merchant
    ? { title: `${merchant.name} — Seti`, description: `Pay ${merchant.name} with Seti.`, robots }
    : { title: 'Merchant not found — Seti', robots };
}

export default async function MerchantLinkPage({ params }: MerchantLinkPageProps) {
  const { handle } = await params;
  const merchant = await loadMerchant(handle);

  if (!merchant) notFound();
  // `/m/<handle>` and `/u/<handle>` are two routes onto ONE namespace. A PERSON's
  // handle opened here goes to its person page rather than pretending to be a shop.
  if (merchant.kind === 'person') redirect(`/u/${handle}`);

  return (
    <main className="min-h-dvh bg-canvas-light text-ink">
      <div className="mx-auto w-full max-w-md px-5 py-10">
        <MerchantPublicView merchant={merchant} />
      </div>
    </main>
  );
}
