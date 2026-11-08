import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import {
  PaymentRequestError,
  REQUEST_CURRENCIES,
  REQUEST_MAX_EXPIRY_DAYS,
  cancelRequest,
  createRequest,
  listRequests,
  type RequestRefusalCode,
} from '../services/requests.js';

/**
 * Asking a person for money (#465).
 *
 * The service underneath (`services/requests.ts`) is the whole state machine: it resolves the payee at
 * creation, snapshots the address behind it, guards settlement with one atomic compare-and-set and
 * derives a lapsed ask on read rather than storing `expired`. Nothing here re-implements any of that.
 * These routes are the shape a client talks to, and the place where a refusal becomes a status code.
 *
 * The paths are declared in full and the module is registered without a prefix, the same way
 * `routes/wallets.ts` declares `/users/:id/wallets`: a prefix here would produce a doubled path that
 * no client calls and every log line misreads.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Shape only. Every field is validated for MEANING in `createRequest`, so a refusal comes back as a
 * code the UI can branch on rather than a zod message that says nothing about which rule failed.
 */
const createSchema = z.object({
  destinationHandle: z.string().min(1).max(64),
  amount: z.string().min(1).max(24),
  currency: z.enum(REQUEST_CURRENCIES).optional(),
  memo: z.string().max(200).optional(),
  /**
   * Days from now, or `null` for an ask that never lapses. Days rather than an absolute instant: a
   * date computed on the client is a date from a client's clock, and the service refuses a past one.
   */
  expiresInDays: z.number().int().min(1).max(REQUEST_MAX_EXPIRY_DAYS).nullable().optional(),
});

/**
 * A code is a fact about the request; a status is what the client branches on.
 *
 * `destination-not-yours` is 403 because it is about permission, and an already-decided ask is 409
 * because the caller's picture of the world is out of date rather than wrong. Everything else is the
 * caller's input (400), except the two that mean the row is not there.
 */
function statusFor(code: RequestRefusalCode): number {
  switch (code) {
    case 'not-found':
    case 'destination-not-found':
      return 404;
    case 'destination-not-yours':
      return 403;
    case 'already-settled':
    case 'already-cancelled':
      return 409;
    default:
      return 400;
  }
}

function refusal(reply: FastifyReply, error: PaymentRequestError) {
  return reply.status(statusFor(error.code)).send({
    error: error.code,
    code: error.code,
    settledTransactionId: error.settledTransactionId,
  });
}

export async function requestRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  /** Create an ask, and get back the link's opaque id. */
  app.post('/requests', async (request, reply) => {
    const caller = request.user;
    if (!caller) return reply.status(401).send({ error: 'Unauthorized' });

    const body = createSchema.parse(request.body);

    try {
      const created = await createRequest({
        creatorId: caller.id,
        destinationHandle: body.destinationHandle,
        amount: body.amount,
        currency: body.currency,
        memo: body.memo,
        expiresAt:
          body.expiresInDays === null
            ? null
            : body.expiresInDays === undefined
              ? undefined
              : new Date(Date.now() + body.expiresInDays * DAY_MS),
      });

      return reply.status(201).send({ request: created });
    } catch (error) {
      if (error instanceof PaymentRequestError) return refusal(reply, error);
      throw error;
    }
  });

  /**
   * The asks this account made, newest first.
   *
   * Scoped to the caller: the id in the path is the caller's, and anyone else's is a 403 rather than an
   * empty list, because an empty list would say "you have none" about somebody else's account.
   */
  app.get('/users/:id/requests', async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const caller = request.user;

    if (!caller || caller.id !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    return { requests: await listRequests(id) };
  });

  /** Close an ask. Ownership is checked inside the service, before its state. */
  app.post('/requests/:publicId/cancel', async (request, reply) => {
    const caller = request.user;
    if (!caller) return reply.status(401).send({ error: 'Unauthorized' });

    const { publicId } = z.object({ publicId: z.string().min(1).max(64) }).parse(request.params);

    try {
      await cancelRequest(publicId, caller.id);
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof PaymentRequestError) return refusal(reply, error);
      throw error;
    }
  });
}
