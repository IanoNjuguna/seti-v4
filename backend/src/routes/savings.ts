import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { getSavingsSummary } from '../services/savings.js';

/**
 * Savings: what the account has put aside, and what it is worth now.
 *
 * A read only. Depositing and withdrawing are the customer's own signatures against
 * the vault — Seti never holds the position, so it can never take it out from under
 * them. That is also why this route cannot say "deposit succeeded": it does not
 * deposit.
 *
 * `available: false` is a normal answer on a network with no vault, and the surface
 * must render that as "savings are not here yet" rather than as an empty balance.
 */
export async function savingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/', async (request: FastifyRequest) => {
    const user = request.user;
    // `authMiddleware` rejects an unauthenticated request before this runs, so a
    // missing user here is a wiring bug, not a client error.
    if (!user) throw new Error('savings route reached without an authenticated user');

    const summary = await getSavingsSummary({ userId: user.id, network: user.network });

    return { savings: summary };
  });
}
