import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import {
  arrivalCopy,
  listArrivals,
  ownedArrivalAddresses,
  summariseArrivals,
  toArrivalView,
} from '../services/arrival-store.js';

/**
 * The merchant's arrivals: money that reached their address with no charge behind it.
 *
 * `GET /arrivals` is the read side of a fact the indexer records and nothing else
 * owns (`services/arrival.ts`, `services/arrival-store.ts`). It exists because
 * non-custody means a payer can always send straight to the address on the QR, and
 * a merchant has to be able to see that money even though no charge was satisfied
 * by it, and therefore no fee was taken.
 *
 * ## What this endpoint refuses to say
 *
 * Each row is the chain's facts: sender, token, amount, transaction, block, and the
 * address that received it. There is no `status`, no `charge`, no `paid`, and no
 * `feeCollected` on a row, because none of those is known. The wording is
 * `ARRIVAL_COPY`, sent with the rows so a surface renders the product's words
 * instead of inventing a fourth sentence for the same fact.
 *
 * ## Whose rows these are
 *
 * Scoped by `request.user`, never by an address in the query: the addresses are
 * resolved server-side from the account's own wallets and its live handle claims
 * on the network the session is served under. An address in a query string would be
 * one account reading another's money.
 *
 * A paginated read has to know whether another page exists, and asking for one more
 * row than is returned is how: a client that pages through these must not be told
 * "there is more" on a page that was exactly full, nor "that was all" when it was
 * not.
 */

/** One page of arrivals. Small: this is a review surface, not a ledger export. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export async function arrivalRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: authMiddleware }, async (request) => {
    // `authMiddleware` has already resolved the caller and the network it acts on.
    const user = request.user;
    if (!user) {
      // Unreachable behind the hook, and returning a body rather than asserting keeps
      // a future route change from turning "no session" into a 500.
      return { arrivals: [], hasMore: false, summary: [], copy: arrivalCopy() };
    }

    const page = querySchema.parse(request.query);

    const recipients = await ownedArrivalAddresses(user.id, user.network);

    // One extra row answers `hasMore` without a COUNT over the same predicate.
    const rows = await listArrivals({
      network: user.network,
      recipients,
      limit: page.limit + 1,
      offset: page.offset,
    });

    const hasMore = rows.length > page.limit;
    const visible = hasMore ? rows.slice(0, page.limit) : rows;

    return {
      arrivals: visible.map(toArrivalView),
      hasMore,
      summary: await summariseArrivals({ network: user.network, recipients }),
      copy: arrivalCopy(),
    };
  });
}
