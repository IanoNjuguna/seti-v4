'use client';

import { Text } from '@/components/ui';
import { PolymarketCard } from '@/components/polymarket/PolymarketCard';

/**
 * `seti.live/app/outcomes` (#599).
 *
 * The first surface of the outcomes destination, and today it holds one read: what an external
 * account of the customer's holds on Polymarket. No order can be placed from here, and
 * that is deliberate rather than unfinished — the card exists to prove the read path and to
 * answer a question the app could not answer before ("is there money over there that I have
 * forgotten about") without touching custody.
 *
 * The page is a client component because the card is, and because the app's pages carry no
 * metadata: every route under `/app` is behind a session and the sitemap does not publish
 * it, so there is nothing here for a crawler to read.
 *
 * ONE CARD, LEFT ALIGNED, WITH A SHARED EDGE. The heading and the card start on the same
 * x, and the card takes the column's full width rather than centring a fixed-width box,
 * which is what makes a screen of one element look composed rather than dropped.
 */
export default function OutcomesPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-28 pt-6">
      <Text variant="display" as="h1">
        Outcomes
      </Text>
      <Text variant="body" color="secondary" as="p" className="mt-1">
        What you hold elsewhere, in one place. Reading only.
      </Text>
      <div className="mt-5">
        <PolymarketCard />
      </div>
    </main>
  );
}
