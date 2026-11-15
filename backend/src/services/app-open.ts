/**
 * WHEN AN ACCOUNT CAME BACK — one row, one local day, one account (#571).
 *
 * Nothing in this product could answer "did this customer come back?". A settled
 * `Transaction` is the obvious proxy, but it conflates two different people: the
 * one who opened the app, looked at their balance and left, and the one who never
 * opened it at all. `user.login` is closer and still wrong — it is written by
 * `POST /auth/verify`, which runs when a session is ESTABLISHED, so a returning
 * customer whose browser still holds a token never produces one.
 *
 * `GET /auth/me` is the route every load goes through: the client holds a token
 * and a remembered user, and the server is the only thing that can say whether
 * those two still agree. Serving that answer IS the open. So this module hangs off
 * it and records the fact once per account per day.
 *
 * ## One row per account per LOCAL day, not per load
 *
 * `/auth/me` runs on every page load, and a row per load would be a clickstream
 * we did not ask for and cannot store cheaply. The question retention asks is
 * "was this account here on this day", so the row is deduped on that: the metric
 * is `count(distinct day)` and a second row for the same day adds nothing.
 *
 * The day is the ACCOUNT's, read from its stored `User.timeZone` through
 * `localMoment` — the same rule `services/analytics.ts` follows for money. Days
 * bucketed in UTC would put a Nairobi customer's 00:30 payment and their 02:30
 * open on different days from the ones their own statement shows.
 *
 * `metadata.day` is stored AT WRITE TIME rather than re-derived by every later
 * reader: the zone is a per-account user setting that can change, and a report
 * that re-bucketed history through today's zone would silently rewrite last
 * month's retention the first time somebody moved country.
 *
 * ## What is deliberately NOT here
 *
 * No session id, no device, no route, no duration: the row is an account, an
 * instant, and the day it bucketed to. `audit_logs` already carries the IP for
 * `user.login`, and this module does not widen what the product knows about a
 * customer. It is a retention COUNTER, and every field is one a reader of the
 * report needs.
 */
import { prisma } from '../lib/prisma.js';
import { logAuditEvent } from './audit.js';
import { localMoment, resolveTimeZone } from './time-zone.js';

/**
 * How far back to look for today's row.
 *
 * Wide enough to cover every offset the day boundary can be on either side of
 * the instant (the widest real ones are +14 and -12), so a single bound serves
 * every zone. Narrow enough that the `[userId, createdAt]` index on `audit_logs`
 * answers it without a scan, and that it can never reach a row from an earlier
 * local day.
 */
const LOOKBACK_MS = 36 * 60 * 60 * 1000;

export interface RecordAppOpenInput {
  userId: string;
  /** The account's stored zone. Resolved and fallback-guarded inside. */
  timeZone?: string | null;
  ip?: string;
  /** The instant to bucket. Injectable so the check can pin a boundary. */
  now?: Date;
}

export interface RecordAppOpenResult {
  /** True when this call wrote the day's row, false when the day was already recorded. */
  recorded: boolean;
  /** The account's local date the call bucketed to (`YYYY-MM-DD`). */
  day: string;
}

/**
 * Record that this account's session was served today, at most once per local day.
 *
 * Returns whether a row was written rather than throwing on a duplicate: the
 * caller is a route that must answer the customer either way, and "we already
 * know" is not an error.
 */
export async function recordAppOpen(input: RecordAppOpenInput): Promise<RecordAppOpenResult> {
  const zone = resolveTimeZone(input.timeZone);
  const now = input.now ?? new Date();
  const day = localMoment(now, zone).date;

  const recent = await prisma.auditLog.findFirst({
    where: {
      userId: input.userId,
      action: 'app.open',
      createdAt: { gte: new Date(now.getTime() - LOOKBACK_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  // The newest row inside the lookback window is the only candidate that can be
  // today: the window never reaches back past yesterday's boundary.
  if (recent && localMoment(recent.createdAt, zone).date === day) {
    return { recorded: false, day };
  }

  await logAuditEvent({
    userId: input.userId,
    action: 'app.open',
    ip: input.ip,
    metadata: { day, timeZone: zone },
  });

  return { recorded: true, day };
}
