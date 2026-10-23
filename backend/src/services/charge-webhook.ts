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
 * **A charge is signed with the secret of the app that owns its recipient.** #156
 * gave a merchant an app record bound to a payout address, and the secret Seti issued
 * for it; when `charge.recipient` is that address, THAT secret signs the delivery, so
 * one merchant's secret cannot verify another merchant's events. Anything else — a
 * charge to a bare address, a withdrawal, every row written before #156 — falls back
 * to the deployment-wide `SETI_WEBHOOK_SECRET`, which is why existing receivers keep
 * working unchanged.
 *
 * The two seams a future change moves through are {@link secretForRecipient} (where
 * the key comes from) and {@link buildWebhookPayload} (what is signed); nothing else
 * in the codebase reads a secret or signs a body.
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
import { WEBHOOK_SIGNATURE_HEADER } from '../lib/webhook-signature.js';
import { logAuditEvent } from './audit.js';
import {
  merchantAppForRecipient,
  merchantAppSecret,
} from './merchant-app.js';
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

/**
 * The header carrying the signature. Defined in `lib/webhook-signature.ts`, because the
 * receiver's verifier and the sender must agree on the name and only one file may own
 * it; re-exported here so every existing import keeps working.
 */
export { WEBHOOK_SIGNATURE_HEADER };
export const WEBHOOK_EVENT_HEADER = 'x-seti-event';
export const WEBHOOK_DELIVERY_HEADER = 'x-seti-delivery';
export const WEBHOOK_CHARGE_HEADER = 'x-seti-charge';
/**
 * The PUBLIC id of the merchant app whose secret signed the delivery (#156).
 *
 * Absent when the deployment-wide key signed it. A label for a merchant's own logs and
 * a support ticket, never something a receiver should authorise on: the signature
 * already says the event is ours.
 */
export const WEBHOOK_APP_HEADER = 'x-seti-app';

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

/** The deployment-wide fallback key. THE SEAM's second half — see the file header. */
export function webhookSecret(): string | null {
  const secret = (env.SETI_WEBHOOK_SECRET ?? '').trim();
  return secret.length > 0 ? secret : null;
}

/**
 * The secret that signs a charge paid to `recipient`, and where that receiver said to
 * POST — THE SEAM.
 *
 * A merchant app bound to the address wins, because that is the merchant's own
 * credential and the whole point of #156: a leaked app secret's blast radius is one
 * merchant's fulfilment logic, not every receiver on the deployment. The
 * deployment-wide key is the fallback, and it is NOT tried when an app matched but its
 * secret could not be opened: quietly signing a merchant's event with a key they do not
 * have would teach them to distrust every signature we send.
 *
 * `webhookUrl` is the APP's endpoint, and it is only ever a fallback for a charge that
 * declared none of its own (see `enqueueChargeWebhook`). It travels back with the secret
 * because the app is where a merchant configures "where my events go" once, instead of
 * on every charge.
 */
export async function secretForRecipient(input: {
  recipient: string;
  network?: string;
}): Promise<{ secret: string; merchantAppId: string | null; webhookUrl: string | null } | null> {
  const app = await merchantAppForRecipient({
    recipient: input.recipient,
    network: input.network === 'mainnet' || input.network === 'testnet' ? input.network : undefined,
  });

  if (app) {
    const appSecret = merchantAppSecret(app);
    if (!appSecret) return null;
    return { secret: appSecret, merchantAppId: app.id, webhookUrl: app.webhookUrl };
  }

  const fallback = webhookSecret();
  return fallback ? { secret: fallback, merchantAppId: null, webhookUrl: null } : null;
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
  // The merchant's own app secret when one owns this recipient, the deployment key
  // otherwise. Resolved BEFORE the row, so the row records which key signed it.
  const signing = await secretForRecipient({ recipient: row.recipient, network: row.network });

  // Where this goes: the URL the charge declared, or — when it declared none — the one
  // its merchant configured on the app that owns the recipient (#156). Without the
  // second, an app's `webhookUrl` would be a column nothing reads, and a merchant who
  // set up their endpoint once would silently receive nothing.
  const url = row.webhookUrl ?? signing?.webhookUrl ?? null;
  if (!url) return null;

  const event = WEBHOOK_EVENT_BY_STATUS[view.status];
  const deliveryId = randomUUID();
  const payload = buildWebhookPayload({ view, deliveryId, sentAt: now });
  const secret = signing?.secret ?? null;

  try {
    const created = await prisma.chargeWebhookDelivery.create({
      data: {
        id: deliveryId,
        chargeId: row.id,
        event,
        status: view.status,
        url,
        state: secret ? 'pending' : 'failed',
        attempts: 0,
        nextAttemptAt: secret ? now : null,
        payload: payload as unknown as Prisma.InputJsonValue,
        merchantAppId: signing?.merchantAppId ?? null,
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

/**
 * One loud line per process, not one per charge: the fault is the deployment's.
 *
 * The name in the message is `webhook-signing-secret-unset`, which now covers BOTH
 * causes: no merchant app owns the recipient AND `SETI_WEBHOOK_SECRET` is unset.
 */
function logMissingSecretOnce(publicId: string): void {
  if (warnedMissingSecret) return;
  warnedMissingSecret = true;
  console.error(
    '[webhook] No key can sign this delivery: no merchant app owns the charge recipient ' +
      'and SETI_WEBHOOK_SECRET is unset. Nothing is sent (first affected charge: ' +
      `${publicId}). Deliveries are recorded as failed with ` +
      'lastError="webhook-signing-secret-unset". Either set SETI_WEBHOOK_SECRET to the same ' +
      'strong value on every backend instance, or have the merchant create an app bound to ' +
      'the address their charges pay.'
  );
}

/** A delivery row with the fact that decides which key signs it. */
type DeliveryWithCharge = DeliveryRow & { charge: { recipient: string; network: string } };

/**
 * The key that signs one stored delivery.
 *
 * Resolved from the CHARGE's recipient rather than from `merchantAppId`, because a row
 * written before #156 has no app id and a charge's recipient never changes: the address
 * is the answer, and the column only records what the answer was at enqueue.
 */
async function deliverySecret(row: DeliveryWithCharge): Promise<string | null> {
  const resolved = await secretForRecipient({
    recipient: row.charge.recipient,
    network: row.charge.network,
  });
  return resolved?.secret ?? null;
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
  const row = await prisma.chargeWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { charge: { select: { recipient: true, network: true } } },
  });
  if (!row || row.state === 'delivered' || row.state === 'failed') return row;

  const secret = await deliverySecret(row);
  if (!secret) return null;

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

  // The PUBLIC app id, when a merchant app signed this delivery (#156). It is a label,
  // never a credential: it lets a merchant with two apps on one endpoint tell their
  // events apart, and it is what support asks for on a ticket. One primary-key read,
  // and only for rows an app signed.
  if (row.merchantAppId) {
    const signer = await prisma.merchantApp.findUnique({
      where: { id: row.merchantAppId },
      select: { publicId: true },
    });
    if (signer) headers[WEBHOOK_APP_HEADER] = signer.publicId;
  }

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
          lastAttemptAt: now,
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
        lastAttemptAt: now,
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
      lastAttemptAt: now,
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
  // No deployment-key gate here any more: a row may be signed by a merchant app's own
  // secret while `SETI_WEBHOOK_SECRET` is unset, and skipping the sweep for that would
  // strand every app's retries. Each row resolves its own key below.
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
  /** When the last POST left, or null if none has. The merchant's "did you try?". */
  lastAttemptAt: string | null;
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
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Re-send ONE delivery, with a fresh timestamp and therefore a fresh signature.
 *
 * ## Why this is a reset and not a new row
 *
 * The uniqueness rule above is one delivery per (charge, status), and it exists so a
 * replay can never double-count an event. A replay that inserted a new row would break
 * exactly that invariant, and a merchant's consumer would see two `charge.paid`
 * deliveries with different delivery ids for one payment.
 *
 * So the row is reset to `pending` and attempted at once. What the merchant gets is the
 * same bytes — the stored payload, the same `X-Seti-Delivery` — signed NOW: the
 * signature covers `<t>.<body>`, and `t` is read at send time, so a replayed delivery
 * verifies against the CURRENT secret. That is the whole point of a replay after a
 * rotation: the old signature is dead, and this is how the merchant gets one that works.
 *
 * A delivery that already succeeded is refused: re-sending it would be a second POST for
 * one event, and the merchant can tell us the endpoint is broken without us pretending
 * the first success did not happen.
 */
export type ReplayVerdict =
  | { ok: true; delivery: DeliveryView }
  | { ok: false; reason: 'not-found' | 'not-replayable' };

export async function replayDelivery(input: {
  deliveryId: string;
  /** The app the caller owns. A delivery of another app is `not-found`, not a 403. */
  merchantAppId: string;
  now?: Date;
}): Promise<ReplayVerdict> {
  const now = input.now ?? new Date();

  const row = await prisma.chargeWebhookDelivery.findUnique({
    where: { id: input.deliveryId },
    include: { charge: { select: { recipient: true, network: true } } },
  });

  if (!row || row.merchantAppId !== input.merchantAppId) {
    return { ok: false, reason: 'not-found' };
  }

  if (row.state === 'delivered') {
    return { ok: false, reason: 'not-replayable' };
  }

  const secret = await deliverySecret(row);
  if (!secret) return { ok: false, reason: 'not-replayable' };

  // Reset the row first, so a crash mid-send leaves a due row the sweep reclaims rather
  // than one stuck in `sending` with nothing in flight.
  await prisma.chargeWebhookDelivery.update({
    where: { id: row.id },
    data: {
      state: 'pending',
      nextAttemptAt: now,
      lastError: null,
    },
  });

  const attempted = await attemptDelivery(row, secret, now);
  return { ok: true, delivery: toDeliveryView(attempted ?? row) };
}

/**
 * One merchant app's delivery log, newest first.
 *
 * Scoped by `merchantAppId`, which is the app whose secret signed the row. A merchant
 * reads their own deliveries and nobody else's, and there is no parameter that widens
 * that: the app id comes from the authenticated route.
 */
export async function readMerchantAppDeliveries(
  merchantAppId: string,
  limit = 50
): Promise<DeliveryView[]> {
  const rows = await prisma.chargeWebhookDelivery.findMany({
    where: { merchantAppId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return rows.map(toDeliveryView);
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
