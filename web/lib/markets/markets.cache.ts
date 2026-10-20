/**
 * A read-through cache in front of the odds feed, using the Workers Cache API.
 *
 * Why this exists rather than a header: `s-maxage` is advice, and a response that a
 * Worker generates does not go through Cloudflare's CDN cache at all unless a Cache
 * Rule matches it. That was measured on the live deployment — no `cf-cache-status`,
 * no `age`, 1.3s on every request. `caches.default` is the one cache a Worker can
 * use without touching zone configuration, so the behaviour travels with the code
 * and survives a redeploy.
 *
 * The policy is deliberately dull:
 *
 *  - Fresh for `FRESH_MS`. Inside that window a hit never touches the network.
 *  - Kept for `RETAIN_MS`, long after it stops being fresh, so an outage has a
 *    last-known answer to serve instead of a failure page.
 *  - One request after expiry pays the upstream round trip. That is at most one slow
 *    request a minute, which is a cheaper thing to accept than a background refresh
 *    that depends on a lifecycle API the Worker adapter has to support.
 *
 * Outside a Worker (`next dev` on Node) there is no `caches` global, and the
 * function simply loads every time. The surface behaves the same; only the speed
 * differs, which is the right way for a dev environment to be different.
 */

const FRESH_MS = 60_000;
const RETAIN_MS = 60 * 60_000;

/** What a caller learns about where the bytes came from. */
export type CacheState = 'hit' | 'miss' | 'stale' | 'off';

export interface CachedResult<T> {
  body: T;
  state: CacheState;
}

interface Entry<T> {
  storedAt: number;
  body: T;
}

/**
 * The Workers default cache.
 *
 * `caches.default` is a Cloudflare extension: the DOM's `CacheStorage` type has
 * `open`, `match`, `has` and `keys`, and no `default` at all. Naming the shape we
 * actually use keeps the widened type honest and makes the absence expressible,
 * which is what `next dev` on Node relies on.
 */
type WorkersCaches = { default?: Cache };

function cacheStore(): Cache | null {
  // The Cache API exists in Workers and in the browser; `next dev` on Node has
  // neither, and a missing cache must degrade to "always load", never to a throw.
  if (typeof caches === 'undefined') return null;
  const store = (caches as unknown as WorkersCaches).default;
  return store ?? null;
}

/**
 * Serve `key` from the cache if it is fresh, otherwise load it and store the result.
 *
 * A load failure with a retained entry serves that entry and says so. With no entry
 * there is nothing to serve, so the error propagates and the route answers 502.
 */
export async function readThroughCache<T>(
  origin: string,
  path: string,
  load: () => Promise<T>
): Promise<CachedResult<T>> {
  const store = cacheStore();
  if (!store) return { body: await load(), state: 'off' };

  const key = new Request(new URL(path, origin), { method: 'GET' });

  let retained: Entry<T> | null = null;
  try {
    const hit = await store.match(key);
    if (hit) retained = (await hit.json()) as Entry<T>;
  } catch {
    // A cache read that throws is not a reason to fail a public read.
    retained = null;
  }

  const age = retained ? Date.now() - retained.storedAt : Number.POSITIVE_INFINITY;
  if (retained && age < FRESH_MS) return { body: retained.body, state: 'hit' };

  try {
    const body = await load();
    await store.put(key, await jsonResponse({ storedAt: Date.now(), body } satisfies Entry<T>));
    return { body, state: 'miss' };
  } catch (error) {
    if (retained) return { body: retained.body, state: 'stale' };
    throw error;
  }
}

/**
 * A response the cache will accept.
 *
 * `max-age` is the RETAIN window, not the freshness window: the Cache API honours
 * the response's own lifetime, so freshness is decided above, on `storedAt`, where
 * it can also express "stale but usable".
 */
async function jsonResponse(body: unknown): Promise<Response> {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
      'cache-control': `max-age=${Math.floor(RETAIN_MS / 1000)}`,
    },
  });
}
