import { MARKETS_SOURCE } from '@/lib/markets/markets.constants';
import { marketsFailure, marketsJson } from '@/lib/markets/markets.http';
import { fetchMarkets } from '@/lib/markets/markets.server';
import type { MarketListResponse } from '@/lib/markets/markets.types';

/**
 * `GET /api/markets` — the odds list, keyless and public.
 *
 * Deliberately uncached by Next (route handlers are not cached by default) and
 * cached by the CDN and the browser instead, through the headers `marketsJson`
 * sets. Next's own caching would need an adapter store on the Workers target for
 * no benefit: the thing worth caching is a 20 KB body with a one-minute freshness
 * rule, which is exactly what `s-maxage` expresses.
 *
 * Nothing here is account-scoped, so it is safe to serve to a signed-out visitor
 * and safe for a shared cache to reuse across visitors.
 */
export async function GET(request: Request): Promise<Response> {
  const updatedAt = new Date();

  try {
    const markets = await fetchMarkets(updatedAt);
    const payload: MarketListResponse = {
      source: MARKETS_SOURCE,
      updatedAt: updatedAt.toISOString(),
      markets,
    };
    return marketsJson(payload, updatedAt, request.headers.get('if-none-match'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Odds feed could not be reached';
    return marketsFailure(message);
  }
}
