import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { findMerchantByHandle } from '../services/merchants.js';
import { toMerchantIdentityView } from '../services/merchant-claims.js';

/**
 * Public merchant reads — the merchant behind a `seti.live/m/<handle>` link.
 *
 * UNAUTHENTICATED ON PURPOSE. This is the endpoint that page server-renders
 * from, and the whole point of the link is that a customer can open it signed
 * out: the identity has to be readable before anyone has a session, or the page
 * would ask a stranger to sign in before it would even say who they are about to
 * pay.
 *
 * It exposes only what the payment link is FOR — the name, the address the money
 * goes to, and whether the name's binding verifies (recomputed from the stored
 * signature, never stored as a flag). Nothing about any customer is reachable
 * here, and nothing here is writable: it is a lookup by the unique handle.
 *
 * Deliberately separate from `routes/merchants.ts`, whose every route sits behind
 * `authMiddleware`. Adding an unauthenticated route to that file would mean
 * auditing the hook on every existing route; a file with no auth hook at all
 * cannot leak one by accident.
 */
export async function publicMerchantRoutes(app: FastifyInstance) {
  app.get('/:handle', async (request, reply) => {
    const { handle } = z.object({ handle: z.string().min(1) }).parse(request.params);

    const merchant = await findMerchantByHandle(handle);

    if (!merchant) {
      return reply.status(404).send({ error: 'Merchant not found' });
    }

    return { merchant: await toMerchantIdentityView(merchant) };
  });
}
