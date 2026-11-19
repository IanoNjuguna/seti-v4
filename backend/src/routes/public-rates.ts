import type { FastifyInstance } from 'fastify';
import { getFxQuote, DEFAULT_FIAT } from '../services/payments.js';

/**
 * The published rate, for a stranger (#586).
 *
 * UNAUTHENTICATED ON PURPOSE, and for the reason a charge is: `/convert` is a page anyone
 * can open, and a rate is not an account fact. One currency, one figure, the publisher it
 * came from and the day it applies to. There is no history, no per-user anything, and
 * nothing here can be written.
 *
 * It answers the SAME question the payment path asks, through the same function, which is
 * the point: a converter that read the Central Bank directly would be a second
 * implementation of "what is a dollar worth", and the day the two drifted the page would
 * quote a price the app does not charge. `getFxQuote` is the single source, with its
 * Central Bank → provider → fallback chain and its per-source freshness rule.
 *
 * `no-store` would be wrong and so would caching for an hour: the figure only moves once a
 * business day, and a five-minute cache keeps a burst of visitors off both upstream hosts
 * without showing yesterday's number for long after it changed.
 */
export async function publicRateRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    const quote = await getFxQuote(DEFAULT_FIAT);

    reply.header('cache-control', 'public, max-age=300, stale-while-revalidate=600');

    return {
      rate: {
        fiatCurrency: quote.fiatCurrency,
        fiatPerUsd: quote.fiatPerUsd,
        source: quote.source,
        publishedFor: quote.publishedFor ?? null,
        asOf: quote.asOf.toISOString(),
        stale: quote.stale,
      },
    };
  });
}
