import { marketsFailure, marketsJson } from '@/lib/markets/markets.http';
import { fetchMarketEvent } from '@/lib/markets/markets.server';
import type { MarketEventResponse } from '@/lib/markets/markets.types';

/**
 * `GET /api/markets/[slug]` — one event and its markets.
 *
 * `404` means the event is closed or the slug is wrong, which is a product fact
 * the detail page renders in words. An upstream failure is a `502` and is NOT
 * cached, so a venue outage cannot be served for a minute afterwards.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { slug } = await context.params;

  if (!slug) return marketsFailure('No event was named');

  const updatedAt = new Date();

  try {
    const event = await fetchMarketEvent(slug, updatedAt);
    if (!event) {
      return Response.json({ event: null } satisfies MarketEventResponse, {
        status: 404,
        headers: { 'cache-control': 'no-store' },
      });
    }

    const payload: MarketEventResponse = { event };
    return marketsJson(payload, updatedAt, request.headers.get('if-none-match'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Odds feed could not be reached';
    return marketsFailure(message);
  }
}
