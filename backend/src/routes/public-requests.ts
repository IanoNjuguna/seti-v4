import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { RateLimiter } from '../lib/rate-limit.js';
import { readPublicRequest } from '../services/requests.js';

/**
 * The ask as a PAYER sees it: one unauthenticated read (#447).
 *
 * This exists because the link has to open for somebody with no Seti account and no JavaScript: a
 * request pasted into a chat reaches people who have neither. So the answer is the small, public subset
 * (`readPublicRequest` selects it field by field, and it has no creator and no transaction id).
 *
 * It never decides anything. The state it reports is derived from the same predicate the settle guard
 * uses, so a lapsed ask reads `expired` here the moment it lapses, with nothing having written it.
 *
 * Rate-limited by IP because it is public: the ids are unguessable (18 hex characters), but an
 * unlimited public read is still a free oracle for anyone who has one.
 */

/** 120 reads a minute per address. Generous for a person, useless for a scanner. */
const limiter = new RateLimiter(120, 60_000);

export async function publicRequestRoutes(app: FastifyInstance) {
  app.get('/:publicId', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.ip;
    if (!limiter.allow(key)) return reply.status(429).send({ error: { code: 'rate-limited' } });

    const params = z.object({ publicId: z.string().min(6).max(32) }).safeParse(request.params);
    if (!params.success) return reply.status(404).send({ error: { code: 'not-found' } });

    const found = await readPublicRequest(params.data.publicId);

    // The same answer for "no such ask" and "a malformed id": an id that names nothing must not be
    // distinguishable from one that names something, or the endpoint becomes a guessability probe.
    if (!found) return reply.status(404).send({ error: { code: 'not-found' } });

    return { request: found };
  });
}
