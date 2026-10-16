import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import {
  getAccountIdentity,
  getDepositTarget,
  isAccountIntent,
  setAccountIntent,
  setAccountNetwork,
} from '../services/account.js';
import { isNetwork } from '../lib/network.js';

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

/**
 * The network switch body.
 *
 * Shape only: the VALUE is validated by the same `isNetwork` guard the session
 * uses, so an unrecognised network is a coded 400 — never a column full of
 * whatever a client felt like sending. Notably this is the ONE place a request
 * names a network, and it is a REQUEST TO SWITCH the account, not an assertion
 * that overrides the session: a switch to live is refused with a reason while the
 * deployment is not mainnet-ready.
 */
const networkSchema = z.object({ network: z.string() });

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

  /**
   * Switch the account's network — Practice ⇄ Live.
   *
   * `network` here is the TARGET of a switch, not an assertion about the current
   * request: the caller is asking the server to move the account, and the server
   * decides whether it can. A switch to `mainnet` is refused with the readiness
   * reason (`mainnet-not-ready`) while no real mainnet batch proof exists — the
   * gate `docs/internal/mainnet-flip.md` already writes — so the Live control can
   * say WHY it is disabled.
   *
   * Everything this returns comes from `getAccountIdentity` on the NEW network:
   * the account's handles there, the deposit address, and the readiness state.
   */
  app.post('/network', async (request, reply) => {
    const caller = request.user;
    if (!caller) {
      return reply.status(401).send({ error: 'Unauthorized', code: 'unauthorized' });
    }

    const body = networkSchema.parse(request.body);

    if (!isNetwork(body.network)) {
      return reply
        .status(400)
        .send({ error: 'network must be "testnet" or "mainnet".', code: 'invalid-network' });
    }

    const result = await setAccountNetwork(caller.id, body.network);

    if (!result.ok) {
      return reply.status(409).send({ error: result.reason, code: result.code });
    }

    return result.identity;
  });

  /**
   * Where money arrives for this account, and WHICH NETWORK that address is on.
   *
   * The deposit surface renders this address and its QR, and the address alone is
   * not enough to render safely: an EVM address is one identifier across chains, so
   * the disambiguation the sender needs is WHICH CHAIN to send on — and which
   * network view the money then appears in. A client whose build serves the other
   * chain would state both wrongly. The answer is computed from the network this
   * DEPLOYMENT serves (`getDepositTarget`), so the value cannot be steered by
   * anything a client sends — which is also why this route takes no body.
   *
   * A null address is a real answer, not an error: the address is registered when
   * the account first signs in, and an account with no wallet row on the served
   * network genuinely has nothing registered here yet.
   */
  app.get('/deposit', async (request, reply) => {
    const caller = request.user;
    if (!caller) {
      return reply.status(401).send({ error: 'Unauthorized', code: 'unauthorized' });
    }

    return getDepositTarget(caller.id);
  });
}
