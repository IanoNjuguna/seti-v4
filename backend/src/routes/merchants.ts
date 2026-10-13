import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import {
  parseQrPayload,
  resolveMerchant,
  findMerchantByHandle,
  findMerchantByName,
} from '../services/merchants.js';
import {
  claimMerchantName,
  merchantHandleStatus,
  MerchantClaimError,
  toMerchantIdentityView,
} from '../services/merchant-claims.js';

/**
 * A claim as it arrives from the browser.
 *
 * Shape only — every field is validated for meaning in `claimMerchantName`, so
 * a refusal comes back with a code the UI can branch on rather than a bare zod
 * 400 that says nothing about which condition failed.
 */
const claimSchema = z.object({
  name: z.string(),
  address: z.string(),
  issuedAt: z.string(),
  nonce: z.string().min(1),
  signature: z.string().min(1),
});

export async function merchantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/resolve', async (request, reply) => {
    const query = z.object({ qr: z.string() }).parse(request.query);
    const payload = parseQrPayload(query.qr);

    if (payload.type !== 'merchant' || !payload.merchantId) {
      return reply.status(400).send({ error: 'Unrecognized QR format' });
    }

    /**
     * By id, then by handle, then by name.
     *
     * A payload is one of: the platform id the backend minted; a handle (the
     * `m/<handle>` of the link a customer scanned, or a handle typed in); or —
     * for a merchant who claimed a name — the name itself. The id lookup is first
     * because it is canonical and cheap. The handle lookup is a `findUnique` on
     * the unique, indexed `handle` column, NOT a reverse-derivation from names:
     * two names can share a handle precisely because the handle rule drops
     * characters, which is why the claim refused the second one. The name lookup
     * is last, and only runs when nothing else matched.
     */
    const merchant =
      (await resolveMerchant(payload.merchantId)) ??
      (await findMerchantByHandle(payload.merchantId)) ??
      (await findMerchantByName(payload.merchantId));

    if (!merchant) {
      return reply.status(404).send({ error: 'Merchant not found' });
    }

    /**
     * `verified` is recomputed from the stored signature here, on the way out,
     * so a client can never be handed an unverified name labelled as verified.
     * A name with no valid signature behind it comes back `verified: false`.
     */
    return {
      merchant: await toMerchantIdentityView(merchant),
      suggestedAmount: payload.amount ?? null,
    };
  });

  /**
   * The handle a name will get, and whether it is free — for the claim form's
   * live preview, BEFORE the merchant signs.
   *
   * This is the claim path's own validation (`merchantHandleStatus`), not a
   * second copy of the rule, so the preview can never call a link free that the
   * claim would then refuse. Behind the same auth as the claim: a signed-in
   * merchant checking a name it is about to sign for, not anonymous enumeration.
   */
  app.get('/handle', async (request) => {
    const query = z.object({ name: z.string() }).parse(request.query);
    return { status: await merchantHandleStatus(query.name) };
  });

  /**
   * Claim a business name for an address.
   *
   * One-time per merchant, costs no gas, and writes nothing on chain — it is a
   * signature we store so anyone can re-verify the binding later. The address
   * always remains authoritative for the money path; the name is only ever a
   * label beside it.
   */
  app.post('/claim', async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', code: 'unauthorized' });
    }

    const body = claimSchema.parse(request.body);

    try {
      const merchant = await claimMerchantName({ ...body, userId: user.id });
      return reply.status(201).send({ merchant: await toMerchantIdentityView(merchant) });
    } catch (error) {
      if (error instanceof MerchantClaimError) {
        return reply.status(error.statusCode).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });
}
