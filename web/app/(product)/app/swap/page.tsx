import type { Metadata } from 'next';
import { SwapScreen } from '@/components/swap/SwapScreen';

/**
 * Swap — `/app/swap`, where one balance becomes another.
 *
 * A server component, like every route in this app that is not reading the session: it
 * carries the title and the robots rule, and the screen behind it is the client. The
 * page itself is private, so it is not indexed and its title is the only metadata it
 * needs.
 *
 * Nothing here reads a query. Which balances are on offer is the book's answer for this
 * account, not a link's, so there is no seed to whitelist and no `Suspense` boundary to
 * carry.
 */
export const metadata: Metadata = {
  title: 'Swap — Seti',
  robots: { index: false, follow: false },
};

export default function SwapPage() {
  return <SwapScreen />;
}
