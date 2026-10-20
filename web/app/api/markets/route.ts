import { MARKETS_SOURCE } from '@/lib/markets/markets.constants';
import { readThroughCache } from '@/lib/markets/markets.cache';
import { marketsFailure, marketsJson } from '@/lib/markets/markets.http';
import { fetchMarkets } from '@/lib/markets/markets.server';
import type { MarketListResponse } from '@/lib/markets/markets.types';

/**
 * `GET /api/markets` — the odds list, keyless and public.
 *
 * Cached in the Worker itself (`readThroughCache`), because a Worker-generated
 * response is not stored by Cloudflare's CDN unless a Cache Rule matches it, and
 * `s-maxage` alone was measured to do nothing: 1.3s on every request. The headers
 * remain — they are what the browser and any future rule should honour — but they
 * are no longer the only thing standing between a visitor and the venue.
 *
 * `updatedAt` comes from the cached body, not from the clock, so the surface's
 * "refreshed at" line describes when the odds were actually read rather than when
 * this particular request happened to be served.
 */
export async function GET(request: Request): Promise<Response> {
  const { origin } = new URL(request.url);

  try {
    const result = await readThroughCache<MarketListResponse>(origin, '/api/markets', async () => {
      const readAt = new Date();
      const markets = await fetchMarkets(readAt);
      return { source: MARKETS_SOURCE, updatedAt: readAt.toISOString(), markets };
    });

    return marketsJson(
      result.body,
      new Date(result.body.updatedAt),
      request.headers.get('if-none-match'),
      result.state
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Odds feed could not be reached';
    return marketsFailure(message);
  }
}
