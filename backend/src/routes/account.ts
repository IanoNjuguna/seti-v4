import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { getAccountIdentity, isAccountIntent, setAccountIntent } from '../services/account.js';

/**
 * The account read the onboarding gate is built on.
 *
 * Kept out of `routes/handles.ts` on purpose: the handle routes are about the
 * NAMESPACE (one string, one signature, who holds it), and this is about the
 * ACCOUNT (which handles are mine, which mode am I in). A second concern in the
 * handle file is how a route ends up with two different auth assumptions.
 *
 * Everything here is behind `authMiddleware`. There is no account id in any
 * path: the answer is always about the CALLER, which is what makes it impossible
 * to ask about someone else's handles by editing a URL.
 */
const intentSchema = z.object({ intent: z.string() });

export async function accountRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  /**
   * Who the caller is, what they hold, and whether that means onboarding is done.
   *
   * Dependents: the `/app` gate (`components/app/AppGate.tsx`) redirects here
   * when `onboarded` is false, and the Profile intent switch reads `intent`.
   */
  app.get('/', async (request, reply) => {
    const caller = request.user;
    if (!caller) {
      return reply.status(401).send({ error: 'Unauthorized', code: 'unauthorized' });
    }

    return getAccountIdentity(caller.id);
  });

  /**
   * Switch the account's mode.
   *
   * Shape-checked here, meaning-checked by the same guard the handle kind uses,
   * so an unrecognised value is a coded 400 rather than a column full of
   * whatever a client felt like sending.
   */
  app.post('/intent', async (request, reply) => {
    const caller = request.user;
    if (!caller) {
      return reply.status(401).send({ error: 'Unauthorized', code: 'unauthorized' });
    }

    const body = intentSchema.parse(request.body);

    if (!isAccountIntent(body.intent)) {
      return reply
        .status(400)
        .send({ error: 'intent must be "personal" or "business".', code: 'invalid-intent' });
    }

    return setAccountIntent(caller.id, body.intent);
  });
}
