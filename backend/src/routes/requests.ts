import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { logAuditEvent } from '../services/audit.js';
import {
  cancelRequest,
  createRequest,
  listRequests,
  PaymentRequestError,
  type RequestRefusalCode,
} from '../services/requests.js';

/**
 * The ask API: create, list, cancel (#447 step 3's backend half).
 *
 * Three authenticated routes and nothing else. The PAYER's side is deliberately NOT here: their link is
 * read without an account (`public-requests.ts`), and the payment that settles it goes through the
 * ordinary send path, which already verifies a receipt. Adding a route that "settles" an ask would be a
 * second way to close one, and #447 exists because there must be exactly one.
 *
 * ## Every refusal is a code, and the code decides the status
 *
 * The service refuses with codes, never with prose, so the surface owns the sentence. The status is the
 * smallest thing that could be true:
 *
 *   404  not-found, destination-not-found, payment-not-found
 *   400  amount-invalid, expiry-invalid, currency-invalid, currency-mismatch
 *   409  already-settled, already-cancelled, amount-short, amount-over, payment-not-*
 *   403  destination-not-yours
 *
 * A 403 for `destination-not-yours` is on purpose: the handle exists and is not the caller's, which is
 * not the same statement as "there is no such handle".
 */

const REFUSAL_STATUS: Record<RequestRefusalCode, number> = {
  'not-found': 404,
  'destination-not-found': 404,
  'destination-not-yours': 403,
  'payment-not-found': 404,
  'payment-not-a-send': 409,
  'payment-not-completed': 409,
  'amount-invalid': 400,
  'amount-short': 409,
  'amount-over': 409,
  'currency-mismatch': 400,
  'currency-invalid': 400,
  'expiry-invalid': 400,
  'expired': 409,
  'already-settled': 409,
  'already-cancelled': 409,
  'transaction-already-used': 409,
};

/**
 * Answers a refusal with its code and nothing else. The `settledTransactionId` rides along on
 * `already-settled`, because the caller's next sentence is "this was already paid" and it needs the id
 * to say which payment.
 */
function refuse(reply: FastifyReply, error: PaymentRequestError) {
  return reply.status(REFUSAL_STATUS[error.code] ?? 400).send({
    error: { code: error.code, settledTransactionId: error.settledTransactionId },
  });
}

const createSchema = z.object({
  /** The handle the money lands on. Must be one the caller owns. */
  destinationHandle: z.string().min(1).max(64),
  /** A decimal string in the customer's currency; the same shape the keypad produces. */
  amount: z.string().min(1).max(16),
  currency: z.string().length(3).optional(),
  memo: z.string().max(140).optional(),
  /**
   * Omitted means the 30-day default. `null` means never, which is a decision the caller makes rather
   * than something it gets by forgetting the field.
   */
  expiresAt: z.union([z.null(), z.string().datetime()]).optional(),
});

export async function requestRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) throw new Error('requests route reached without an authenticated user');

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'body-invalid' } });
    }

    const body = parsed.data;

    try {
      const created = await createRequest({
        creatorId: user.id,
        destinationHandle: body.destinationHandle,
        amount: body.amount,
        currency: body.currency,
        memo: body.memo,
        expiresAt:
          body.expiresAt === undefined ? undefined : body.expiresAt === null ? null : new Date(body.expiresAt),
      });

      await logAuditEvent({
        userId: user.id,
        action: 'request.created',
        metadata: { publicId: created.publicId, amount: created.amount, currency: created.currency },
      });

      return reply.status(201).send({ request: created });
    } catch (error) {
      if (error instanceof PaymentRequestError) return refuse(reply, error);
      throw error;
    }
  });

  app.get('/', async (request: FastifyRequest) => {
    const user = request.user;
    if (!user) throw new Error('requests route reached without an authenticated user');

    return { requests: await listRequests(user.id) };
  });

  app.post('/:publicId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) throw new Error('requests route reached without an authenticated user');

    const params = z.object({ publicId: z.string().min(6).max(32) }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: { code: 'body-invalid' } });

    try {
      await cancelRequest(params.data.publicId, user.id);
      await logAuditEvent({
        userId: user.id,
        action: 'request.cancelled',
        metadata: { publicId: params.data.publicId },
      });
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof PaymentRequestError) return refuse(reply, error);
      throw error;
    }
  });
}
