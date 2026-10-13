import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import {
  parseQrPayload,
  findHandleByHandle,
  findHandleByName,
  findHandleByMerchantId,
} from '../services/handles.js';
import {
  claimHandle,
  handleStatus,
  HandleClaimError,
  isHandleKind,
  toHandleIdentityView,
} from '../services/handle-claims.js';

/**
 * A claim as it arrives from the browser.
 *
 * Shape only — every field is validated for meaning in `claimHandle`, so a
 * refusal comes back with a code the UI can branch on rather than a bare zod
 * 400 that says nothing about which condition failed.
 */
const claimSchema = z.object({
  kind: z.string(),
  name: z.string(),
  address: z.string(),
  issuedAt: z.string(),
  nonce: z.string().min(1),
  signature: z.string().min(1),
});

export async function handleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  /**
   * The ONE resolver. A person's username, a business's name, a stored handle, a
   * platform id or a seti:// QR all arrive as one string and leave as one kind of
   * identity — the name, the address the money goes to, and whether it verifies.
   */
  app.get('/resolve', async (request, reply) => {
    const query = z.object({ q: z.string() }).parse(request.query);
    const payload = parseQrPayload(query.q);

    if (payload.type !== 'merchant' || !payload.merchantId) {
      return reply.status(400).send({ error: 'Unrecognized QR format' });
    }

    /**
     * By id, then by handle, then by name.
     *
     * A payload is one of: the platform id the backend minted; a handle (the
     * `/m/<handle>` or `/u/<handle>` of a link, or a handle typed in); or — for
     * anyone who claimed a handle — the name itself. The id lookup is first
     * because it is canonical and cheap. The handle lookup is a `findUnique` on
     * the unique, indexed `handle` column, NOT a reverse-derivation from names:
     * two names can share a handle precisely because the handle rule drops
     * characters, which is why the claim refused the second one. The name lookup
     * is last, and only runs when nothing else matched.
     */
    const handle =
      (await findHandleByMerchantId(payload.merchantId)) ??
      (await findHandleByHandle(payload.merchantId)) ??
      (await findHandleByName(payload.merchantId));

    if (!handle) {
      return reply.status(404).send({ error: 'Handle not found' });
    }

    /**
     * `verified` is recomputed from the stored signature here, on the way out, so
     * a client can never be handed an unverified name labelled as verified. A
     * name with no valid signature behind it comes back `verified: false`.
     */
    return {
      handle: await toHandleIdentityView(handle),
      suggestedAmount: payload.amount ?? null,
    };
  });

  /**
   * The handle a name will get, and whether it is free — for the claim form's
   * live preview, BEFORE the person signs.
   *
   * This is the claim path's own validation (`handleStatus`), not a second copy
   * of the rule, so the preview can never call a handle free that the claim would
   * then refuse. Behind the same auth as the claim: a signed-in user checking a
   * handle they are about to sign for, not anonymous enumeration.
   */
  app.get('/status', async (request) => {
    const query = z.object({ name: z.string(), kind: z.string().optional() }).parse(request.query);
    return { status: await handleStatus(query.name) };
  });

  /**
   * Claim a username or business name for an address.
   *
   * One-time, costs no gas, and writes nothing on chain — it is a signature we
   * store so anyone can re-verify the binding later. The address always remains
   * authoritative for the money path; the name is only ever a label beside it.
   * `kind` is the profile MODE, and it is what the signed `purpose` distinguishes:
   * a signature for one cannot be replayed as the other.
   */
  app.post('/claim', async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', code: 'unauthorized' });
    }

    const body = claimSchema.parse(request.body);

    if (!isHandleKind(body.kind)) {
      return reply
        .status(400)
        .send({ error: 'kind must be "person" or "business".', code: 'invalid-kind' });
    }

    try {
      const handle = await claimHandle({ ...body, kind: body.kind, userId: user.id });
      return reply.status(201).send({ handle: await toHandleIdentityView(handle) });
    } catch (error) {
      if (error instanceof HandleClaimError) {
        return reply.status(error.statusCode).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });
}
