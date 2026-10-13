import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { findHandleByHandle } from '../services/handles.js';
import { toHandleIdentityView } from '../services/handle-claims.js';

/**
 * Public handle reads — the identity behind a `seti.live/m/<handle>` or
 * `seti.live/u/<handle>` link.
 *
 * UNAUTHENTICATED ON PURPOSE. This is the endpoint the public pages
 * server-render from, and the whole point of a link is that a customer can open
 * it signed out: the identity has to be readable before anyone has a session, or
 * the page would ask a stranger to sign in before it would even say who they are
 * about to pay.
 *
 * It exposes only what a link is FOR — the name, the kind, the address the money
 * goes to, and whether the binding verifies (recomputed from the stored
 * signature, never stored as a flag). Nothing about any customer is reachable
 * here, and nothing here is writable: it is a lookup by the unique handle.
 *
 * Deliberately separate from `routes/handles.ts`, whose every route sits behind
 * `authMiddleware`. Adding an unauthenticated route to that file would mean
 * auditing the hook on every existing route; a file with no auth hook at all
 * cannot leak one by accident.
 */
export async function publicHandleRoutes(app: FastifyInstance) {
  app.get('/:handle', async (request, reply) => {
    const { handle } = z.object({ handle: z.string().min(1) }).parse(request.params);

    const row = await findHandleByHandle(handle);

    if (!row) {
      return reply.status(404).send({ error: 'Handle not found' });
    }

    return { handle: await toHandleIdentityView(row) };
  });
}
