import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { RateLimiter } from '../lib/rate-limit.js';
import {
  MerchantAppError,
  createMerchantApp,
  findOwnedMerchantApp,
  listMerchantApps,
  revokeMerchantApp,
  rotateMerchantAppSecret,
  toMerchantAppView,
  MERCHANT_APP_NAME_MAX,
  type MerchantAppAdminAction,
} from '../services/merchant-app.js';
import {
  readMerchantAppDeliveries,
  replayDelivery,
} from '../services/charge-webhook.js';
import type { PaymentRefusalCode } from '../services/payment-refusal.js';

/**
 * A merchant's app record and the credential Seti issues for it (#156).
 *
 * ## What this route family is NOT
 *
 * It is not a way to call the charge API. A merchant app is a **public id** (safe to
 * print, and what support quotes) plus a **webhook secret** that proves our events are
 * ours. Neither can create a charge and neither can move money:
 *
 *  - creating a charge needs an EIP-712 signature by the RECIPIENT's key, held by the
 *    merchant's wallet and never sent anywhere (`routes/public-charges.ts`);
 *  - reading a charge's delivery log needs that same key;
 *  - every route here needs the merchant's Privy SESSION, and the app id is not one.
 *
 * The app id appears in a request only as a value this API looks up, never as an
 * authority. `npm run check:merchant-app` drives all three of those claims, because
 * "the id cannot act" is the property the whole feature rests on.
 *
 * ## The secret leaves twice
 *
 * `POST /merchant-apps` returns it in the `201`, and `POST /merchant-apps/:id/secret/rotate`
 * returns the new one in the `200`. No other route, log line or audit row carries it:
 * {@link toMerchantAppView} has no field for it, and the store keeps it sealed under
 * `SETI_SECRET_BOX_KEY`. A merchant who loses it rotates, which is one signed tap.
 *
 * ## Refusals are codes
 *
 * Every failure answers `{ error, code }` from the one taxonomy
 * (`services/payment-refusal.ts`). `error` is one sentence for a human log; a client
 * switches on `code`. A `merchant_app-*` throw is mapped here, so a check that
 * asserts a code is asserting what a merchant's dashboard actually receives.
 */

/** Creating and rotating: a person, not a fleet. Per account, per hour. */
const WRITE_PER_USER = new RateLimiter(30, 60 * 60_000);

/** Lists and delivery logs, which a dashboard reads on every page load. */
const READ_PER_USER = new RateLimiter(240, 60_000);

/** One refusal, in the shape every route already speaks. */
function refuse(reply: FastifyReply, status: number, code: PaymentRefusalCode, error: string) {
  return reply.status(status).send({ error, code });
}

/**
 * Turn a `MerchantAppError` into the refusal its `code` names.
 *
 * One place, because a second copy is how a `merchant-app-revoked` ends up a 500 on
 * one route and a 409 on another. A fault that is NOT one of these keeps travelling
 * to the shared error handler, which answers a 5xx with no driver vocabulary.
 */
function refuseMerchantApp(reply: FastifyReply, error: unknown) {
  if (error instanceof MerchantAppError) {
    return refuse(reply, error.status, error.code, error.message);
  }
  throw error;
}

/** The caller's account id, or `null` when the middleware did not attach one. */
function callerId(request: FastifyRequest): string | null {
  return request.user?.id ?? null;
}

/** The path parameter every route below is scoped by. */
const appIdParams = z.object({
  /**
   * A public id. Deliberately NOT `MERCHANT_APP_ID_PATTERN`-gated: an id that is
   * malformed and an id that names nobody both answer `merchant-app-not-found`, so
   * this route never confirms the shape of a real one to a probe.
   */
  publicId: z.string().min(1).max(64),
});

/** The create body: the app as its payout address signed it. */
const createBody = z.object({
  name: z.string().min(1).max(MERCHANT_APP_NAME_MAX),
  payoutAddress: z.string().min(1).max(64),
  webhookUrl: z.string().min(1).max(2048),
  website: z.string().max(2048).nullish(),
  logoUrl: z.string().max(2048).nullish(),
  issuedAt: z.string().min(1).max(64),
  nonce: z.string().min(1).max(128),
  signature: z.string().min(1).max(512),
});

/**
 * The body a managing call carries.
 *
 * `action` is a CLOSED set and it is inside the signed message, so a rotation
 * signature cannot be replayed as a revoke. It is taken from the path here rather
 * than from the body, and checked against the set, so a signature over `rotate` sent
 * to the revoke route recovers to a signer whose message said something else and is
 * refused.
 */
const manageBody = z.object({
  issuedAt: z.string().min(1).max(64),
  nonce: z.string().min(1).max(128),
  signature: z.string().min(1).max(512),
});

export async function merchantAppRoutes(app: FastifyInstance) {
  /** Every route here is behind the session. There is no public half. */
  app.addHook('preHandler', authMiddleware);

  // -------------------------------------------------------------------------
  // POST /merchant-apps — create, and be shown the secret once
  // -------------------------------------------------------------------------
  app.post('/', async (request, reply) => {
    const owner = callerId(request);
    if (!owner) return reply.status(401).send({ error: 'Unauthorized' });

    if (!WRITE_PER_USER.allow(`create:${owner}`)) {
      return refuse(reply, 429, 'rate-limited', 'Too many apps created from this account. Try again shortly.');
    }

    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) {
      // A malformed body is the client's fault and the shared handler answers 400
      // `INVALID_REQUEST_BODY`; throwing keeps that one shape across the API.
      throw parsed.error;
    }

    try {
      const { app: view, secret } = await createMerchantApp({
        ownerUserId: owner,
        body: parsed.data,
      });

      // 201 with the secret, and this is the only response that ever carries it.
      // `Cache-Control: no-store` because a proxy is not a place to leave a key.
      return reply
        .header('cache-control', 'no-store')
        .status(201)
        .send({ app: view, secret });
    } catch (error) {
      return refuseMerchantApp(reply, error);
    }
  });

  // -------------------------------------------------------------------------
  // GET /merchant-apps — the merchant's apps, without any secret
  // -------------------------------------------------------------------------
  app.get('/', async (request, reply) => {
    const owner = callerId(request);
    if (!owner) return reply.status(401).send({ error: 'Unauthorized' });

    if (!READ_PER_USER.allow(`list:${owner}`)) {
      return refuse(reply, 429, 'rate-limited', 'Too many requests. Try again shortly.');
    }

    return { apps: await listMerchantApps(owner) };
  });

  // -------------------------------------------------------------------------
  // GET /merchant-apps/:publicId — one app
  // -------------------------------------------------------------------------
  app.get('/:publicId', async (request, reply) => {
    const owner = callerId(request);
    if (!owner) return reply.status(401).send({ error: 'Unauthorized' });

    if (!READ_PER_USER.allow(`read:${owner}`)) {
      return refuse(reply, 429, 'rate-limited', 'Too many requests. Try again shortly.');
    }

    const { publicId } = appIdParams.parse(request.params);

    try {
      const row = await findOwnedMerchantApp({ ownerUserId: owner, publicId });
      return { app: await toMerchantAppView(row) };
    } catch (error) {
      return refuseMerchantApp(reply, error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /merchant-apps/:publicId/secret/rotate — one signed tap
  // -------------------------------------------------------------------------
  app.post('/:publicId/secret/rotate', async (request, reply) => {
    const owner = callerId(request);
    if (!owner) return reply.status(401).send({ error: 'Unauthorized' });

    if (!WRITE_PER_USER.allow(`rotate:${owner}`)) {
      return refuse(reply, 429, 'rate-limited', 'Too many rotations from this account. Try again shortly.');
    }

    const { publicId } = appIdParams.parse(request.params);
    const parsed = manageBody.safeParse(request.body);
    if (!parsed.success) throw parsed.error;

    // The action is the PATH's and it is one of the closed set. `recoverAdminSigner`
    // verifies the signature over exactly this value, so a signature made for
    // `revoke` cannot rotate.
    const action = 'rotate' satisfies MerchantAppAdminAction;

    try {
      const { app: view, secret } = await rotateMerchantAppSecret({
        ownerUserId: owner,
        publicId,
        action,
        issuedAt: parsed.data.issuedAt,
        nonce: parsed.data.nonce,
        signature: parsed.data.signature,
      });

      return reply.header('cache-control', 'no-store').send({ app: view, secret });
    } catch (error) {
      return refuseMerchantApp(reply, error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /merchant-apps/:publicId/revoke — the rollback
  // -------------------------------------------------------------------------
  app.post('/:publicId/revoke', async (request, reply) => {
    const owner = callerId(request);
    if (!owner) return reply.status(401).send({ error: 'Unauthorized' });

    if (!WRITE_PER_USER.allow(`revoke:${owner}`)) {
      return refuse(reply, 429, 'rate-limited', 'Too many requests from this account. Try again shortly.');
    }

    const { publicId } = appIdParams.parse(request.params);
    const parsed = manageBody.safeParse(request.body);
    if (!parsed.success) throw parsed.error;

    try {
      const view = await revokeMerchantApp({
        ownerUserId: owner,
        publicId,
        issuedAt: parsed.data.issuedAt,
        nonce: parsed.data.nonce,
        signature: parsed.data.signature,
      });

      return { app: view };
    } catch (error) {
      return refuseMerchantApp(reply, error);
    }
  });

  // -------------------------------------------------------------------------
  // GET /merchant-apps/:publicId/deliveries — this app's delivery log
  // -------------------------------------------------------------------------
  app.get('/:publicId/deliveries', async (request, reply) => {
    const owner = callerId(request);
    if (!owner) return reply.status(401).send({ error: 'Unauthorized' });

    if (!READ_PER_USER.allow(`deliveries:${owner}`)) {
      return refuse(reply, 429, 'rate-limited', 'Too many requests. Try again shortly.');
    }

    const { publicId } = appIdParams.parse(request.params);

    try {
      const row = await findOwnedMerchantApp({ ownerUserId: owner, publicId });
      return { deliveries: await readMerchantAppDeliveries(row.id) };
    } catch (error) {
      return refuseMerchantApp(reply, error);
    }
  });

  // -------------------------------------------------------------------------
  // POST /merchant-apps/:publicId/deliveries/:deliveryId/replay
  // -------------------------------------------------------------------------
  app.post('/:publicId/deliveries/:deliveryId/replay', async (request, reply) => {
    const owner = callerId(request);
    if (!owner) return reply.status(401).send({ error: 'Unauthorized' });

    if (!WRITE_PER_USER.allow(`replay:${owner}`)) {
      return refuse(reply, 429, 'rate-limited', 'Too many requests from this account. Try again shortly.');
    }

    const { publicId, deliveryId } = appIdParams
      .extend({ deliveryId: z.string().min(1).max(64) })
      .parse(request.params);

    try {
      const row = await findOwnedMerchantApp({ ownerUserId: owner, publicId });
      const verdict = await replayDelivery({ deliveryId, merchantAppId: row.id });

      if (!verdict.ok) {
        return refuse(
          reply,
          verdict.reason === 'not-found' ? 404 : 409,
          verdict.reason === 'not-found' ? 'delivery-not-found' : 'delivery-not-replayable',
          verdict.reason === 'not-found'
            ? 'No delivery with that id for this app.'
            : 'That delivery already succeeded, so a replay would be a second POST for one event.'
        );
      }

      return { delivery: verdict.delivery };
    } catch (error) {
      return refuseMerchantApp(reply, error);
    }
  });
}
