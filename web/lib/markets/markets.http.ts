import { MARKETS_CACHE_CONTROL } from './markets.constants';

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
export function marketsJson(payload: unknown, updatedAt: Date, ifNoneMatch: string | null): Response {
  const etag = etagFor(updatedAt);

  if (ifNoneMatch !== null && ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { etag, 'cache-control': MARKETS_CACHE_CONTROL } });
  }

  return Response.json(payload, {
    headers: { etag, 'cache-control': MARKETS_CACHE_CONTROL },
  });
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
