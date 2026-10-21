import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { getSavingsSummary, quoteSavingsDeposit } from '../services/savings.js';

const quoteSchema = z.object({
  /** The amount the customer typed, in THEIR currency — as everywhere in this app. */
  amountFiat: z.string().regex(/^\d+(\.\d+)?$/),
});

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

  /**
   * Price a deposit: the swap into the vault's asset, the approval, and the shares
   * the vault should mint. Nothing is signed here.
   */
  app.post('/quote', async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user) throw new Error('savings route reached without an authenticated user');

    const body = quoteSchema.parse(request.body);

    try {
      const quote = await quoteSavingsDeposit({
        userId: user.id,
        amountFiat: body.amountFiat,
        network: user.network,
      });
      return reply.send({ quote });
    } catch (error) {
      // A refusal the customer can act on (no market, bad amount) is a 422 with a
      // sentence; anything else is ours to fix.
      return reply.status(422).send({
        error: error instanceof Error ? error.message : 'Could not price that deposit.',
        code: 'savings-quote-unavailable',
      });
    }
  });
}