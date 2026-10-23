import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { RateLimiter } from '../lib/rate-limit.js';
import { usableWebhookUrl as webhookUrlVerdict } from '../lib/webhook-url.js';
import { SUPPORTED_ASSETS } from '../config/assets.js';
import { chargeVerifies, type SignedCharge } from '../services/charge.js';
import {
  CHARGE_ADMIN_HEADERS,
  verifyChargeAdmin,
  verifyChargeList,
} from '../services/charge-admin.js';
import { expireChargeIfDue, applyChargeTransition } from '../services/charge-store.js';
import {
  CHARGE_ID_PATTERN,
  createCharge,
  findIdempotentReplay,
  listChargesByRecipient,
  loadChargeView,
  toChargeView,
  chargeAmountUnits,
  normaliseAddress,
} from '../services/charge-store.js';
import { readChargeDeliveries } from '../services/charge-webhook.js';
import { logAuditEvent } from '../services/audit.js';
import { network as servedChain, isListedOn } from '../services/chain.js';
import type { PaymentRefusalCode } from '../services/payment-refusal.js';

/**
 * The public charge API — the first unauthenticated WRITE in the product.
 *
 * Three routes and one read of a delivery log, and the whole surface is
 *
 *   POST /public/charges            create (recipient-signed; no Seti account)
 *   GET  /public/charges/:id        status, txHash, timestamps
 *   POST /public/charges/:id/cancel recipient-signed, only from pending
 *   GET  /public/charges/:id/deliveries  the recipient's own delivery log
 *
 * ## The signature IS the account
 *
 * There is no API key here and that is deliberate (issue #131's non-goals): the
 * recipient's wallet signs the charge, `chargeVerifies` checks it before ANY row is
 * written, and whoever controls that key can manage the charge. A key would make Seti
 * the custodian of the identifier, which is the thing the send path already avoids.
 *
 * ## Refusals are codes, never prose
 *
 * Every refusal answers `{ error, code }` and the code is from the ONE taxonomy
 * (`services/payment-refusal.ts`) — the same list a payment already uses. A client
 * switches on `code`; `error` is one sentence for a human log. This file therefore
 * contains no refusal string that a client is expected to parse.
 *
 * ## Limits, because this is where rows come from
 *
 * Two budgets on create, sized for the two callers that exist: a merchant creating
 * charges all day, and a script discovering what it can do. A per-address hour is
 * generous enough for the first and a per-source minute is tight enough that the
 * second cannot spend the database on our behalf. Reads are limited per source too,
 * because the pay page reads through here and a page is cheap to request.
 */

/** Response header an idempotent replay carries, so a client can see it was one. */
const IDEMPOTENT_REPLAY_HEADER = 'idempotent-replay';

/**
 * A real merchant's hour. High enough that a busy shop never sees a 429, low enough
 * that one address cannot fill the table.
 */
const CREATE_PER_RECIPIENT = new RateLimiter(120, 60 * 60_000);

/** A script's minute. Ten times lower per window than a merchant gets per hour. */
const CREATE_PER_SOURCE = new RateLimiter(20, 60_000);

/** Page reads, which a link's forwards count against. */
const READ_PER_SOURCE = new RateLimiter(120, 60_000);

/** Managing calls (cancel, delivery log), which are a person or a cron, not a crowd. */
const ADMIN_PER_SOURCE = new RateLimiter(30, 60_000);

/** A payee reconciling invoices: a handful of pages a minute, not a crawl. */
const LIST_PER_SOURCE = new RateLimiter(20, 60_000);

/** How many charges one listing may return, and the default. */
export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 50;

/** The header a create may carry. Honoured for 24 hours (`charge-store.ts`). */
const IDEMPOTENCY_HEADER = 'idempotency-key';
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

/**
 * The create body: the charge as the recipient signed it.
 *
 * Types are strict here and values are not. A wrong TYPE is a malformed body (400,
 * through the shared error handler); a wrong VALUE is either a signature that does
 * not hold (`charge-signature-invalid`) or an amount that is not an amount
 * (`amount-invalid`), both 422. That split is what lets "a tampered amount returns
 * 422" be true even though the body's shape was fine.
 */
const createBodySchema = z.object({
  id: z.string().min(1).max(64),
  recipient: z.string().min(1).max(64),
  asset: z.enum(SUPPORTED_ASSETS),
  amount: z.string().min(1).max(64),
  memo: z.string().max(512),
  expiresAt: z.string().min(1).max(64),
  nonce: z.string().min(1).max(128),
  scope: z.string().max(512).nullable().optional(),
  signature: z.string().min(1).max(512),
  /** Optional, declared once at create; there is no update route. */
  webhookUrl: z.string().max(2048).optional(),
});

type CreateBody = z.infer<typeof createBodySchema>;

/** One refusal, in the shape every route already speaks. */
function refuse(
  reply: FastifyReply,
  status: number,
  code: PaymentRefusalCode,
  error: string
) {
  return reply.status(status).send({ error, code });
}

/** A 429, naming the budget that ran out. */
function tooMany(reply: FastifyReply, scope: string) {
  return reply.status(429).send({
    error: `Too many requests (${scope}). Try again shortly.`,
    code: 'rate-limited' satisfies PaymentRefusalCode,
  });
}

/**
 * A webhook URL we are willing to POST to.
 *
 * The rule itself lives in `lib/webhook-url.ts` (`webhookUrlVerdict`), because a
 * merchant app's webhook URL is the same promise to the same kind of receiver: one
 * copy, one place to get it wrong. See that file for why loopback is the only
 * exception.
 */

/** The three admin headers, read from one place so GET and POST agree. */
function adminHeaders(request: FastifyRequest) {
  const headers = request.headers as Record<string, string | string[] | undefined>;
  const read = (name: string) => {
    const value = headers[name];
    return typeof value === 'string' ? value : null;
  };

  return {
    signature: read(CHARGE_ADMIN_HEADERS.signature),
    issuedAt: read(CHARGE_ADMIN_HEADERS.issuedAt),
    nonce: read(CHARGE_ADMIN_HEADERS.nonce),
  };
}

export async function publicChargeRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------------
  // POST /public/charges
  // -------------------------------------------------------------------------
  app.post('/', async (request, reply) => {
    const source = request.ip || 'unknown';
    if (!CREATE_PER_SOURCE.allow(source)) return tooMany(reply, 'per source');

    const parsed = createBodySchema.safeParse(request.body);
    if (!parsed.success) {
      // The shared handler turns a ZodError into 400 INVALID_REQUEST_BODY; throwing
      // it keeps one shape for "your body is malformed" across the API.
      throw parsed.error;
    }

    const body: CreateBody = parsed.data;

    // The recipient's address is the rate-limit key, so it has to be usable before
    // anything else is checked. An unusable one is a refusal, not a 500.
    const recipient = normaliseAddress(body.recipient);
    if (!recipient) {
      return refuse(reply, 422, 'recipient-invalid', `"${body.recipient}" is not a usable address.`);
    }

    if (!CREATE_PER_RECIPIENT.allow(recipient)) return tooMany(reply, 'per address');

    if (!CHARGE_ID_PATTERN.test(body.id)) {
      return refuse(
        reply,
        422,
        'charge-id-invalid',
        'A charge id is 6–64 characters of lower-case letters, digits, "-" and "_".'
      );
    }

    // The signature comes FIRST, before anything is written and before any of the
    // body's other values are believed: an amount, a recipient or an expiry that the
    // payee did not sign is not a charge to be stored with a caveat.
    const signed: SignedCharge = {
      id: body.id,
      recipient: recipient as `0x${string}`,
      asset: body.asset,
      amount: body.amount,
      memo: body.memo,
      expiresAt: body.expiresAt,
      nonce: body.nonce,
      scope: body.scope ?? null,
      signature: body.signature,
    };

    if (!(await chargeVerifies(signed, servedChain.chainId))) {
      return refuse(
        reply,
        422,
        'charge-signature-invalid',
        `This signature does not come from ${recipient}, so the amount, memo, expiry and id were not signed by the payee.`
      );
    }

    const amountUnits = chargeAmountUnits(body.amount);
    if (amountUnits === null || amountUnits <= 0n) {
      return refuse(reply, 422, 'amount-invalid', `"${body.amount}" is not a positive token amount.`);
    }

    const webhook = webhookUrlVerdict(body.webhookUrl);
    if (webhook.kind === 'invalid') {
      return refuse(
        reply,
        422,
        'webhook-url-invalid',
        'webhookUrl must be an https URL (http is accepted only for localhost outside production).'
      );
    }

    const webhookUrl = webhook.kind === 'url' ? webhook.url : null;

    const rawKey = request.headers[IDEMPOTENCY_HEADER];
    const idempotencyKey =
      typeof rawKey === 'string' && rawKey.trim() !== '' ? rawKey.trim().slice(0, MAX_IDEMPOTENCY_KEY_LENGTH) : null;

    // The idempotent replay is answered HERE, before the expiry and asset checks: a
    // client retrying an hour later must get the charge it created (and the body it got
    // then), not `charge-expired` about a charge that exists and is fine. Same-key-
    // different-charge is a 409 the client can act on, never a silent second charge.
    const replay = await findIdempotentReplay({
      recipient,
      idempotencyKey,
      signature: signed.signature,
      webhookUrl,
    });

    if (replay.kind === 'reused') {
      return refuse(
        reply,
        409,
        'idempotency-key-reused',
        'That Idempotency-Key was used for a different charge. Use a new key for a new charge.'
      );
    }

    if (replay.kind === 'replay') {
      // 200, not 201: nothing was created. The body is the exact one this key
      // produced the first time — same bytes, so a client may hash it.
      return reply
        .header(IDEMPOTENT_REPLAY_HEADER, 'true')
        .type('application/json')
        .status(200)
        .send(replay.body);
    }

    const expiresAt = Date.parse(body.expiresAt);
    if (Number.isNaN(expiresAt)) {
      return refuse(reply, 422, 'charge-invalid', `expiresAt "${body.expiresAt}" is not an ISO-8601 instant.`);
    }

    if (expiresAt <= Date.now()) {
      return refuse(
        reply,
        422,
        'charge-expired',
        'A charge cannot be created already expired; a link nobody could pay is not a request.'
      );
    }

    // A charge is payable only in a token THIS chain lists: it is matched against
    // transfers on the served chain, and an asset the registry does not carry has no
    // contract to match against.
    if (!isListedOn(body.asset)) {
      return refuse(
        reply,
        422,
        'asset-mismatch',
        `${body.asset} is not listed on this deployment's chain, so a transfer could never settle this charge.`
      );
    }

    const result = await createCharge({
      charge: signed,
      network: servedChain.network,
      chainId: servedChain.chainId,
      webhookUrl,
      idempotencyKey,
    });

    if (result.kind === 'idempotency-key-reused') {
      return refuse(
        reply,
        409,
        'idempotency-key-reused',
        'That Idempotency-Key was used for a different charge. Use a new key for a new charge.'
      );
    }

    if (result.kind === 'id-taken') {
      return refuse(
        reply,
        409,
        'charge-id-taken',
        `Charge ${body.id} already exists for ${recipient}. A charge id is single-use per recipient.`
      );
    }

    if (result.kind === 'replayed') {
      // 200, not 201: nothing was created. The body is the exact one this key
      // produced the first time — same bytes, so a client may hash it.
      return reply
        .header(IDEMPOTENT_REPLAY_HEADER, 'true')
        .type('application/json')
        .status(200)
        .send(result.body);
    }

    await logAuditEvent({
      action: 'charge.created',
      metadata: {
        chargeId: result.view.id,
        recipient: result.view.recipient,
        asset: result.view.asset,
        amount: result.view.amount,
        expiresAt: result.view.expiresAt,
        network: result.view.network,
        webhook: webhook.kind === 'url',
        idempotent: idempotencyKey !== null,
      },
    });

    return reply.status(201).type('application/json').send(result.body);
  });

  // -------------------------------------------------------------------------
  // GET /public/charges?recipient=0x…&limit=…
  //
  // A payee's own rows, and the only read here that returns a SET. Signed like every
  // other managing call (`ChargeList`, see `services/charge-admin.ts`) because an
  // unsigned listing would let anyone walk a merchant's invoices by address: the
  // charges are public one at a time — that is what a pay link is — but the set is
  // not public, and `recipient` alone is a string anybody can type.
  // -------------------------------------------------------------------------
  app.get('/', async (request, reply) => {
    if (!LIST_PER_SOURCE.allow(request.ip || 'unknown')) return tooMany(reply, 'per source');

    const query = z
      .object({
        recipient: z.string().min(1).max(64),
        limit: z.coerce.number().int().min(1).max(LIST_MAX_LIMIT).default(LIST_DEFAULT_LIMIT),
      })
      .parse(request.query);

    const recipient = normaliseAddress(query.recipient);
    if (!recipient) {
      return refuse(
        reply,
        422,
        'recipient-invalid',
        `"${query.recipient}" is not an address, so no key can have signed for its charges.`
      );
    }

    const verified = await verifyChargeList({
      recipient,
      limit: query.limit,
      headers: adminHeaders(request),
      chainId: servedChain.chainId,
    });

    if (!verified.ok) return refuse(reply, 403, verified.code, verified.reason);

    const rows = await listChargesByRecipient({ recipient, network: servedChain.network, limit: query.limit });

    // A listing is a read, and a read must not report a lapsed charge as pending: the
    // same rule GET /:id follows applies to every row here, one expiry at a time.
    const now = new Date();
    const charges = [];
    for (const row of rows) {
      const current = row.status === 'pending' && row.expiresAt <= now
        ? ((await expireChargeIfDue(row)) ?? row)
        : row;
      charges.push(toChargeView(current));
    }

    return { recipient, limit: query.limit, count: charges.length, charges };
  });

  // -------------------------------------------------------------------------
  // GET /public/charges/:id
  // -------------------------------------------------------------------------
  app.get('/:id', async (request, reply) => {
    if (!READ_PER_SOURCE.allow(request.ip || 'unknown')) return tooMany(reply, 'per source');

    const { id } = z.object({ id: z.string().min(1).max(64) }).parse(request.params);

    const loaded = await loadChargeView(id);

    if (loaded.kind === 'not-found') {
      // One 404 for a malformed id and for an id that names nothing: the endpoint is
      // public, so it must not answer "that id is well-formed but unused".
      return reply.status(404).send({ error: 'No charge with that id.' });
    }

    if (loaded.kind === 'invalid') {
      // A stored charge whose signature no longer holds is NOT rendered: the page
      // shows a refusal instead, and no amount ever reaches a payer.
      return refuse(
        reply,
        422,
        'charge-signature-invalid',
        `Charge ${id} does not verify against its own recipient, so it is not payable.`
      );
    }

    // A read of a lapsed charge expires it on the spot, so the answer is right even
    // where no indexer is running. Idempotent, and the webhook follows exactly once
    // (`charge-store.ts`).
    const row = (await expireChargeIfDue(loaded.row)) ?? loaded.row;

    return { charge: toChargeView(row) };
  });

  // -------------------------------------------------------------------------
  // POST /public/charges/:id/cancel
  // -------------------------------------------------------------------------
  app.post('/:id/cancel', async (request, reply) => {
    if (!ADMIN_PER_SOURCE.allow(request.ip || 'unknown')) return tooMany(reply, 'per source');

    const { id } = z.object({ id: z.string().min(1).max(64) }).parse(request.params);

    const loaded = await loadChargeView(id);
    if (loaded.kind === 'not-found') return reply.status(404).send({ error: 'No charge with that id.' });
    if (loaded.kind === 'invalid') {
      return refuse(reply, 422, 'charge-signature-invalid', `Charge ${id} does not verify, so it cannot be managed.`);
    }

    const verified = await verifyChargeAdmin({
      chargeId: id,
      recipient: loaded.row.recipient,
      action: 'cancel',
      headers: adminHeaders(request),
      chainId: loaded.row.chainId,
    });

    if (!verified.ok) return refuse(reply, 403, verified.code, verified.reason);

    // A charge past its deadline has already ended; cancelling it would tell the
    // recipient they ended something that lapsed.
    const due = await expireChargeIfDue(loaded.row);
    if (due) {
      return refuse(
        reply,
        409,
        'charge-expired',
        `Charge ${id} passed its deadline at ${loaded.row.expiresAtRaw} and is already inert.`
      );
    }

    if (loaded.row.status !== 'pending') {
      return refuse(reply, 409, 'charge-not-pending', `Charge ${id} is ${loaded.row.status}; only a pending charge can be cancelled.`);
    }

    const now = new Date();
    const cancelled = await applyChargeTransition({
      row: loaded.row,
      to: 'expired',
      cancelledAt: now,
      now,
    });

    // Lost the race to a payment (or another cancel): answer with what actually
    // happened rather than claiming a cancel that did not occur.
    if (!cancelled) {
      return refuse(reply, 409, 'charge-not-pending', `Charge ${id} is no longer pending, so it was not cancelled.`);
    }

    await logAuditEvent({
      action: 'charge.cancelled',
      metadata: { chargeId: id, recipient: cancelled.recipient, cancelledAt: now.toISOString() },
    });

    return { charge: toChargeView(cancelled) };
  });

  // -------------------------------------------------------------------------
  // GET /public/charges/:id/deliveries
  // -------------------------------------------------------------------------
  app.get('/:id/deliveries', async (request, reply) => {
    if (!ADMIN_PER_SOURCE.allow(request.ip || 'unknown')) return tooMany(reply, 'per source');

    const { id } = z.object({ id: z.string().min(1).max(64) }).parse(request.params);

    const loaded = await loadChargeView(id);
    if (loaded.kind === 'not-found') return reply.status(404).send({ error: 'No charge with that id.' });
    if (loaded.kind === 'invalid') {
      return refuse(reply, 422, 'charge-signature-invalid', `Charge ${id} does not verify, so it cannot be read.`);
    }

    // The log says where the recipient's own endpoint was called, so it is the
    // recipient's to read: the same signature that authorises a cancel authorises it.
    const verified = await verifyChargeAdmin({
      chargeId: id,
      recipient: loaded.row.recipient,
      action: 'deliveries',
      headers: adminHeaders(request),
      chainId: loaded.row.chainId,
    });

    if (!verified.ok) return refuse(reply, 403, verified.code, verified.reason);

    return { deliveries: await readChargeDeliveries(loaded.row.id) };
  });
}
