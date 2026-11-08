import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readPublicRequest } from '../services/requests.js';

/**
 * The public read an ask's link page needs (#465).
 *
 * UNAUTHENTICATED ON PURPOSE, for the same reason a charge's page is: the payer opened a link, not a
 * session, and may have no Seti account at all. Its own file with no auth hook anywhere in it, so this
 * route cannot leak an authenticated neighbour by accident, the same rule as `public-handles.ts`,
 * `public-charges.ts` and `public-payees.ts`.
 *
 * WHAT IT RETURNS, and what it never does. The public id is 18 hex characters and is the capability, so
 * holding one is enough to read an ask; that is why the answer is narrow: the amount, the currency, the
 * memo, the payee's display name, and whether it has lapsed. It never names the REQUESTER, never says
 * who asked whom, and never carries an account id, because the person holding the link was told about
 * one payment, not about somebody's account.
 *
 * A miss is a `404` here rather than a `200` with a null: unlike an address, which may simply have no
 * name yet, an ask either exists or the link is wrong, and the page has to say which.
 */
export async function publicRequestRoutes(app: FastifyInstance) {
  app.get('/:publicId', async (request, reply) => {
    const { publicId } = z
      .object({ publicId: z.string().min(1).max(64) })
      .parse(request.params);

    const found = await readPublicRequest(publicId);
    if (!found) return reply.status(404).send({ error: 'request-not-found' });

    return { request: found };
  });
}
