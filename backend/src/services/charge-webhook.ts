/**
 * Webhook delivery for charges — `charge.paid`, `charge.underpaid`, `charge.expired`.
 *
 * The rule the whole file serves: **one delivery per status change, exactly.** Three
 * mechanisms enforce it, and each covers a failure the others do not:
 *
 *  - The database's unique `(chargeId, status)` — a second enqueue for the same move
 *    collides and this module reads the existing row instead of creating another.
 *  - The transition itself is a conditional UPDATE (`charge-store.ts`), so a
 *    replayed transfer cannot produce a second status change to enqueue.
 *  - The `attempts` column is the claim: two processes that both pick up a due row
 *    race on `UPDATE … WHERE attempts = <what I read>`, and only one wins. That is
 *    why a retry cannot become two POSTs, and why a crash mid-send becomes a row the
 *    next sweep reclaims rather than a row stuck forever.
 *
 * ## The signature
 *
 * `X-Seti-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>` over
 * `"<t>.<raw body>"` — the shape Stripe and most receivers already parse. The
 * timestamp is INSIDE the signed string, so a captured header cannot be replayed
 * against a different instant; a receiver should reject an old `t` (60s is plenty
 * for a machine that is not asleep, 5 minutes is the safe outer bound).
 *
 * ## The signing secret, and the seam
 *
 * **There is ONE secret for every charge: `SETI_WEBHOOK_SECRET`.** Per-merchant
 * secrets belong to #156 (merchant app records, scoped keys); until then a single
 * deployment-wide key is the only honest option, because a per-charge key would have
 * to be handed back to a caller who has no account to hand it to. The two seams a
 * future change moves through are {@link webhookSecret} (where the key comes from)
 * and {@link buildWebhookPayload} (what is signed); nothing else in the codebase
 * reads the secret or signs a body.
 *
 * When the secret is unset a delivery is NOT attempted: an unsigned webhook is a
 * webhook a receiver must reject, and sending one would teach a receiver to accept
 * it. The row is written as `failed` with `lastError = "webhook-signing-secret-unset"`
 * so the recipient's own delivery log says exactly why nothing arrived, and the
 * server logs one loud line.
 */
import { createHmac, randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logAuditEvent } from './audit.js';
import type { ChargeStatus } from './charge.js';
import type { ChargeView } from './charge-store.js';
import type {
  Charge as ChargeRow,
  ChargeWebhookDelivery as DeliveryRow,
  Prisma,
} from '@prisma/client';

/**
 * The event name a receiver switches on, per status.
 *
 * `overpaid` is delivered as `charge.paid`: money arrived at or ABOVE what was
 * asked, and a merchant who has to handle a fourth event to learn that would be
 * handling the same fact twice. The body carries `charge.status` and
 * `charge.received`, so the difference is still visible to whoever wants it.
 */
export const WEBHOOK_EVENT_BY_STATUS: Record<ChargeStatus, string> = {
  pending: 'charge.pending',
  paid: 'charge.paid',
  overpaid: 'charge.paid',
  underpaid: 'charge.underpaid',
  expired: 'charge.expired',
};

/** The header carrying the signature. Documented in `docs/api-reference.md`. */
export const WEBHOOK_SIGNATURE_HEADER = 'x-seti-signature';
export const WEBHOOK_EVENT_HEADER = 'x-seti-event';
export const WEBHOOK_DELIVERY_HEADER = 'x-seti-delivery';
export const WEBHOOK_CHARGE_HEADER = 'x-seti-charge';

/**
 * Backoff between attempts, in seconds. Six attempts over roughly eight hours.
 *
 * Sized for the failure that actually happens — a receiver deployed at the wrong
 * moment, or down for a restart — rather than for an outage that lasts a day. After
 * the last one the row is `failed`, which is a state the recipient can SEE in their
 * delivery log instead of guessing about.
 */
export const WEBHOOK_BACKOFF_SECONDS = [60, 300, 900, 3600, 6 * 3600] as const;

/** Total attempts: the first, plus one per backoff step. */
export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_BACKOFF_SECONDS.length + 1;

/** How long a single POST may take before it is a failure. */
const WEBHOOK_TIMEOUT_MS = 10_000;

/** A `sending` row older than this is treated as abandoned and reclaimed. */
const WEBHOOK_STALE_CLAIM_MS = 5 * 60_000;

/** The key deliveries are signed with. THE SEAM — see the file header. */
export function webhookSecret(): string | null {
  const secret = (env.SETI_WEBHOOK_SECRET ?? '').trim();
  return secret.length > 0 ? secret : null;
}

/**
 * The signature header value for a body and an instant.
 *
 * Exported because the check suite verifies a real delivery with it, and because a
 * receiver's documentation has to be checked against an implementation that is
 * actually used — a second copy of this string in a test proves nothing.
 */
export function signWebhook(input: {
  secret: string;
  timestampSeconds: number;
  body: string;
}): string {
  const hmac = createHmac('sha256', input.secret);
  hmac.update(`${input.timestampSeconds}.${input.body}`);
  return `t=${input.timestampSeconds},v1=${hmac.digest('hex')}`;
}

/** What a receiver gets. Frozen shape: this is a public contract. */
export interface ChargeWebhookPayload {
  /** `charge.paid` | `charge.underpaid` | `charge.expired`. */
  event: string;
  /** Unique per (charge, status change). Stable across retries of ONE delivery. */
  deliveryId: string;
  /** When this payload was built, ISO-8601. Retries reuse it, so it is not the send time. */
  sentAt: string;
  /** The charge, as the API returns it. Amounts are decimal token units. */
  charge: ChargeView;
}

/**
 * The exact body of a delivery. Built ONCE, at enqueue, and stored on the row: a
 * retry re-sends what the receiver would have got, so the two attempts describe the
 * same instant of the same charge rather than whatever is true ten minutes later.
 */
export function buildWebhookPayload(input: {
  view: ChargeView;
  deliveryId: string;
  sentAt: Date;
}): ChargeWebhookPayload {
  return {
    event: WEBHOOK_EVENT_BY_STATUS[input.view.status],
    deliveryId: input.deliveryId,
    sentAt: input.sentAt.toISOString(),
    charge: input.view,
  };
}

/**
 * Create the delivery row for a status change and attempt it once.
 *
 * Returns `null` when there is nothing to do: no `webhookUrl` on the charge, or a
 * delivery for this status already exists (which is the exactly-once rule doing its
 * job, not an error). The first attempt is awaited — a merchant watching their own
 * endpoint during onboarding should see the POST immediately — but a failure never
 * propagates: the row records it and the sweep retries.
 */
export async function enqueueChargeWebhook(
  row: ChargeRow,
  view: ChargeView,
  now: Date = new Date()
): Promise<DeliveryRow | null> {
  if (!row.webhookUrl) return null;

  const event = WEBHOOK_EVENT_BY_STATUS[view.status];
  const deliveryId = randomUUID();
  const payload = buildWebhookPayload({ view, deliveryId, sentAt: now });
  const secret = webhookSecret();

  try {
    const created = await prisma.chargeWebhookDelivery.create({
      data: {
        id: deliveryId,
        chargeId: row.id,
        event,
        status: view.status,
        url: row.webhookUrl,
        state: secret ? 'pending' : 'failed',
        attempts: 0,
        nextAttemptAt: secret ? now : null,
        payload: payload as unknown as Prisma.InputJsonValue,
        ...(secret ? {} : { lastError: 'webhook-signing-secret-unset' }),
      },
    });

    if (!secret) {
      logMissingSecretOnce(row.publicId);
      return created;
    }

    return (await attemptDelivery(created, secret)) ?? created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      // A delivery for this (charge, status) already exists. Exactly what "one
      // delivery per status change" means; nothing to count twice.
      return null;
    }
    throw error;
  }
}

let warnedMissingSecret = false;

/** One loud line per process, not one per charge: the fault is the deployment's. */
function logMissingSecretOnce(publicId: string): void {
  if (warnedMissingSecret) return;
  warnedMissingSecret = true;
  console.error(
    '[webhook] SETI_WEBHOOK_SECRET is unset, so no webhook can be signed and none is ' +
      `sent (first affected charge: ${publicId}). Deliveries are recorded as failed with ` +
      'lastError="webhook-signing-secret-unset". Set the variable to the same strong value ' +
      'on every backend instance; receivers verify against it.'
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === 'P2002';
}

/**
 * POST one delivery, once, and record what happened.
 *
 * The claim is the `attempts` value read at the top: another process that picked up
 * the same row has either seen a different `attempts` or will fail this UPDATE. A
 * `3xx` is a failure rather than something to follow — a webhook endpoint that
 * redirects is either misconfigured or pointed at something that should not be
 * reached from inside the network.
 */
export async function deliverChargeWebhook(
  deliveryId: string,
  now: Date = new Date()
): Promise<DeliveryRow | null> {
  const secret = webhookSecret();
  if (!secret) return null;

  const row = await prisma.chargeWebhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!row || row.state === 'delivered' || row.state === 'failed') return row;

  const claim = await prisma.chargeWebhookDelivery.updateMany({
    where: { id: row.id, attempts: row.attempts, state: { in: ['pending', 'sending'] } },
    data: { state: 'sending' },
  });

  if (claim.count === 0) return null;

  return attemptDelivery(row, secret, now);
}

/** The POST itself. Shared by the inline attempt and the sweep. */
async function attemptDelivery(
  row: DeliveryRow,
  secret: string,
  now: Date = new Date()
): Promise<DeliveryRow | null> {
  const body = JSON.stringify(row.payload ?? { event: row.event });
  const timestampSeconds = Math.floor(now.getTime() / 1000);

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'Seti-Webhook/1',
    [WEBHOOK_SIGNATURE_HEADER]: signWebhook({ secret, timestampSeconds, body }),
    [WEBHOOK_EVENT_HEADER]: row.event,
    [WEBHOOK_DELIVERY_HEADER]: row.id,
    [WEBHOOK_CHARGE_HEADER]: String((row.payload as { charge?: { id?: string } } | null)?.charge?.id ?? ''),
  };

  const attempts = row.attempts + 1;

  try {
    const response = await fetch(row.url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (response.ok) {
      return prisma.chargeWebhookDelivery.update({
        where: { id: row.id },
        data: {
          state: 'delivered',
          attempts,
          lastStatusCode: response.status,
          lastError: null,
          deliveredAt: now,
          nextAttemptAt: null,
        },
      });
    }

    return scheduleRetry(row, attempts, now, `http_${response.status}`, response.status);
  } catch (error) {
    // A transport fault, a timeout, a DNS failure — one line, never the stack: this
    // string is shown to the recipient in their delivery log.
    const reason = error instanceof Error ? error.name : 'request_failed';
    return scheduleRetry(row, attempts, now, reason);
  }
}

/** Stop, or wait `WEBHOOK_BACKOFF_SECONDS[attempts - 1]` and try again. */
async function scheduleRetry(
  row: DeliveryRow,
  attempts: number,
  now: Date,
  reason: string,
  statusCode?: number
): Promise<DeliveryRow> {
  if (attempts >= WEBHOOK_MAX_ATTEMPTS) {
    return prisma.chargeWebhookDelivery.update({
      where: { id: row.id },
      data: {
        state: 'failed',
        attempts,
        lastStatusCode: statusCode ?? null,
        lastError: `${reason} (gave up after ${attempts} attempts)`,
        nextAttemptAt: null,
      },
    });
  }

  const waitSeconds = WEBHOOK_BACKOFF_SECONDS[Math.min(attempts - 1, WEBHOOK_BACKOFF_SECONDS.length - 1)];

  return prisma.chargeWebhookDelivery.update({
    where: { id: row.id },
    data: {
      state: 'pending',
      attempts,
      lastStatusCode: statusCode ?? null,
      lastError: reason,
      nextAttemptAt: new Date(now.getTime() + waitSeconds * 1000),
    },
  });
}

/**
 * Attempt every delivery that is due.
 *
 * Ordered oldest-first and bounded, because each row is one outbound HTTP request:
 * a backlog must be walked, not fired at once. A row left in `sending` by a process
 * that died is reclaimed after {@link WEBHOOK_STALE_CLAIM_MS}, or it would wait
 * forever for a claim that no longer exists.
 */
export async function deliverDueWebhooks(
  limit = 25,
  now: Date = new Date()
): Promise<{ attempted: number; delivered: number }> {
  const secret = webhookSecret();
  if (!secret) return { attempted: 0, delivered: 0 };

  const staleBefore = new Date(now.getTime() - WEBHOOK_STALE_CLAIM_MS);
  const due = await prisma.chargeWebhookDelivery.findMany({
    where: {
      OR: [
        { state: 'pending', nextAttemptAt: { lte: now } },
        { state: 'sending', updatedAt: { lt: staleBefore } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let delivered = 0;
  let attempted = 0;

  for (const row of due) {
    const result = await deliverChargeWebhook(row.id, now);
    if (!result) continue;
    attempted += 1;
    if (result.state === 'delivered') delivered += 1;
  }

  return { attempted, delivered };
}

/** One delivery, as the recipient reads it in the log. No secret, no signature. */
export interface DeliveryView {
  id: string;
  event: string;
  status: ChargeStatus;
  url: string;
  state: string;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toDeliveryView(row: DeliveryRow): DeliveryView {
  return {
    id: row.id,
    event: row.event,
    status: row.status,
    url: row.url,
    state: row.state,
    attempts: row.attempts,
    lastStatusCode: row.lastStatusCode,
    lastError: row.lastError,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The delivery log for one charge, newest first.
 *
 * This is the API's answer to "did my endpoint get it?" and it is a READ of rows
 * that already exist — there is no way to trigger a delivery from here, so a
 * recipient cannot use it to hammer their own endpoint (or ours).
 */
export async function readChargeDeliveries(chargeRowId: string): Promise<DeliveryView[]> {
  const rows = await prisma.chargeWebhookDelivery.findMany({
    where: { chargeId: chargeRowId },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map(toDeliveryView);
}

/** One audit row per delivery attempt that decided something, best-effort. */
export async function auditDelivery(row: DeliveryRow): Promise<void> {
  try {
    await logAuditEvent({
      action: 'charge.webhook.delivered',
      metadata: {
        chargeId: (row.payload as { charge?: { id?: string } } | null)?.charge?.id ?? null,
        deliveryId: row.id,
        event: row.event,
        state: row.state,
        attempts: row.attempts,
        statusCode: row.lastStatusCode,
      },
    });
  } catch (error) {
    console.error(
      '[webhook] could not record the delivery in audit_logs',
      error instanceof Error ? error.message : error
    );
  }
}
