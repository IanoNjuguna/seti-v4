import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readSharedReceipt } from '../services/receipt-link.js';
import { RateLimiter } from '../lib/rate-limit.js';

/**
 * The shared receipt read — the second door onto a receipt, for a merchant.
 *
 * UNAUTHENTICATED ON PURPOSE, and it is the whole point: the owner hands the
 * link to someone with no Seti session. The capability is the signed token in
 * `?t=`, verified in `readSharedReceipt`; nothing about whose receipt it is needs
 * a caller identity, because the token IS the entitlement.
 *
 * Deliberately its own file, like `public-merchants.ts`: a file with no auth hook
 * cannot leak one, whereas adding an unauthenticated route to `transactions.ts`
 * (every route of which sits behind `authMiddleware`) would mean auditing the hook
 * on every route to prove none of them lost it.
 *
 * EVERY refusal is the SAME 404 — an unknown id, a missing token, a forged token,
 * an expired one, a token bound to a different receipt — so the endpoint can never
 * be used to test whether a guessed id exists. There is exactly one body and one
 * status for all of them.
 */
const NOT_FOUND = { error: 'No receipt for that link.' };

const publicIdSchema = z.string().min(1).max(64);

/**
 * Modest, and deliberately coarse: a shared link is opened by one or two people,
 * so this never touches a real reader, and it bounds id-guessing. Keyed by
 * address because there is no session to key by.
 */
const limiter = new RateLimiter(60, 60_000);

export async function receiptRoutes(app: FastifyInstance) {
  app.get('/:publicId', async (request, reply) => {
    if (!limiter.allow(request.ip || 'unknown')) {
      return reply.status(429).send({ error: 'Too many requests. Try again shortly.' });
    }

    const parsedId = publicIdSchema.safeParse((request.params as { publicId?: unknown }).publicId);
    const query = request.query as { t?: unknown };
    const token = typeof query.t === 'string' ? query.t : null;

    if (!parsedId.success) {
      return reply.status(404).send(NOT_FOUND);
    }

    const receipt = await readSharedReceipt(parsedId.data, token);

    if (!receipt) {
      return reply.status(404).send(NOT_FOUND);
    }

    return receipt;
  });
}
