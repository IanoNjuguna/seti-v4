import { GAMMA_EVENTS_URL, GAMMA_MARKETS_URL, MARKETS_ROW_LIMIT } from './markets.constants';
import { normalizeEvent, normalizeMarketRows } from './markets.map';
import type { GammaEvent, GammaMarket, MarketEvent, MarketSummary } from './markets.types';

/**
 * The one place that talks to the venue.
 *
 * Server-only: it runs inside the route handlers, so the browser never calls the
 * upstream API, never sees its host in a network tab, and cannot be handed a shape
 * the mapper has not already validated. There is no key — the feed is public and
 * read-only — which is why this surface can exist before any integration is
 * decided.
 *
 * Failures are thrown with the cause spelled out (`Odds feed answered 503`), never
 * swallowed into an empty list: an empty list is a product statement ("nothing is
 * open"), and a broken feed is not that.
 */

export class MarketsFeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketsFeedError';
  }
}

const REQUEST_TIMEOUT_MS = 8_000;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new MarketsFeedError(`Odds feed answered ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error instanceof MarketsFeedError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MarketsFeedError('Odds feed timed out');
    }
    throw new MarketsFeedError('Odds feed could not be reached');
  } finally {
    clearTimeout(timer);
  }
}

/** The list, already normalized, formatted and sorted. */
export async function fetchMarkets(now: Date = new Date()): Promise<MarketSummary[]> {
  const url = new URL(GAMMA_MARKETS_URL);
  url.searchParams.set('limit', String(MARKETS_ROW_LIMIT));
  url.searchParams.set('closed', 'false');
  url.searchParams.set('active', 'true');
  url.searchParams.set('order', 'volume24hr');
  url.searchParams.set('ascending', 'false');

  const payload = await fetchJson(url.toString());
  if (!Array.isArray(payload)) {
    throw new MarketsFeedError('Odds feed returned an unexpected shape');
  }
  return normalizeMarketRows(payload as GammaMarket[], now);
}

/**
 * One event by slug.
 *
 * `/events?slug=` answers a single event with its markets nested, measured at
 * ~18 KB, so the detail route costs one small read rather than the 7.3 MB list
 * shape. A `null` means "closed or wrong link", not an error.
 */
export async function fetchMarketEvent(slug: string, now: Date = new Date()): Promise<MarketEvent | null> {
  const url = new URL(GAMMA_EVENTS_URL);
  url.searchParams.set('slug', slug);

  const payload = await fetchJson(url.toString());
  if (!Array.isArray(payload) || payload.length === 0) return null;
  return normalizeEvent(payload[0] as GammaEvent, now);
}
