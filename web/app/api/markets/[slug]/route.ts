import { readThroughCache } from '@/lib/markets/markets.cache';
import { marketsFailure, marketsJson } from '@/lib/markets/markets.http';
import { fetchMarketEvent } from '@/lib/markets/markets.server';
import type { MarketEventResponse } from '@/lib/markets/markets.types';

/**
 * `GET /api/markets/[slug]` — one event and its markets.
 *
 * Cached per slug in the Worker (`readThroughCache`), with the same 60-second
 * freshness and the same hour-long fallback. The key is the slug, so a popular event
 * pays the venue once a minute and the other 59 seconds are served from memory.
 *
 * A closed event is not cached as a failure: `event: null` travels inside the body
 * with a 404, and the cache stores it like any other answer, so a dead link does not
 * become a venue call on every load.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { slug } = await context.params;
  if (!slug) return marketsFailure('No event was named');

  const { origin } = new URL(request.url);

  try {
    const result = await readThroughCache<MarketEventResponse>(
      origin,
      `/api/markets/${encodeURIComponent(slug)}`,
      async () => ({ event: await fetchMarketEvent(slug) })
    );

    if (!result.body.event) {
      return Response.json(result.body, {
        status: 404,
        headers: { 'cache-control': 'no-store', 'x-markets-cache': result.state },
      });
    }

    return marketsJson(
      result.body,
      new Date(),
      request.headers.get('if-none-match'),
      result.state
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Odds feed could not be reached';
    return marketsFailure(message);
  }
}
