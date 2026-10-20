import { MARKETS_CACHE_CONTROL } from './markets.constants';
import type { CacheState } from './markets.cache';

/**
 * The two responses every markets route can give, and the caching that keeps the
 * venue off the hot path.
 *
 * `ETag` is derived from the minute the payload was built, not from a hash of the
 * body: prices change every minute anyway, so a body hash would buy a few extra
 * 304s and cost a full serialization and comparison on every request. A minute
 * bucket is the same freshness the CDN already honours, and it makes revalidation
 * a header check instead of a download.
 *
 * On a failure there is deliberately NO cache header: a 502 that gets cached for
 * a minute is an outage with a delay fuse.
 */
export function marketsJson(
  payload: unknown,
  updatedAt: Date,
  ifNoneMatch: string | null,
  cacheState: CacheState
): Response {
  const etag = etagFor(updatedAt);
  /**
   * `x-markets-cache` is how the caching is TOLD APART from its absence. The previous
   * version of this endpoint set the right headers and served every request from the
   * venue, and nothing in the response said so — a claim nobody could check. One
   * header makes a hit, a miss and a stale serve observable with curl.
   */
  const headers = {
    etag,
    'cache-control': MARKETS_CACHE_CONTROL,
    'x-markets-cache': cacheState,
  };

  if (ifNoneMatch !== null && ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers });
  }

  return Response.json(payload, { headers });
}

export function marketsFailure(message: string): Response {
  return Response.json(
    { error: message },
    { status: 502, headers: { 'cache-control': 'no-store' } }
  );
}

function etagFor(updatedAt: Date): string {
  const minute = Math.floor(updatedAt.getTime() / 60_000);
  return `W/"markets-${minute}"`;
}
