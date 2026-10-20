import type { Metadata } from 'next';
import { MarketsScreen } from '@/components/markets/MarketsScreen';

/**
 * `/app/markets` — the browse surface.
 *
 * A server component whose whole body is one client module: the page needs no data
 * of its own, because the odds are public and the client fetches them through
 * `/api/markets` with its own cache headers. Rendering it on the server would mean
 * two data paths to keep in step for a page with no account behind it.
 */
export const metadata: Metadata = {
  title: 'Seti — Markets',
  description: 'What the crowd thinks will happen, in live odds.',
};

export default function MarketsPage() {
  return <MarketsScreen />;
}
