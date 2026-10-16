import type { Hex } from 'viem';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { getTransactionReceipt, servedNetwork } from './chain.js';
import { normalizeNetwork } from '../lib/network.js';
import { logAuditEvent } from './audit.js';

/**
 * Resolves transaction rows left in `processing`.
 *
 * Why this exists: `/transactions/pay` writes a row as `processing` and then
 * awaits `confirmTransactionByHash` inline. If that request dies — a crash, a
 * timeout, a client that hangs up — the row is never advanced, and nothing else
 * ever looked at it. The indexer only *confirms* rows it sees in a scanned
 * Transfer log, and it never marks one failed, so a row could sit in
 * `processing` forever: the customer's app shows a payment that never resolves,
 * and no alert fires.
 *
 * The realistic shape of a stuck row is "the chain settled it and the database
 * did not hear about it", because `recordPayment` only writes a row after it has
 * already read a *successful* receipt. So the sweep re-reads the chain and
 * advances the row to the state the chain reports.
 *
 * Two rules make this safe to run anywhere, including on several replicas at
 * once:
 *
 *  1. **Every write is conditional** on the row still being `processing`
 *     (compare-and-set, the same shape the indexer cursor uses). Two sweeps
 *     racing cannot both advance a row, and a sweep cannot overwrite a state
 *     the inline confirmation just wrote.
 *  2. **No receipt means no write.** A row is only ever created after a
 *     successful receipt was observed, so "there is no receipt now" is a
 *     contradiction — a reorg, a wrong-chain hash, or an RPC that disagrees with
 *     the one that recorded it. That needs a human, and inventing a terminal
 *     state would hide it. Those rows are reported, never rewritten.
 */

export interface StuckRowReport {
  id: string;
  txHash: string;
  ageMinutes: number;
  reason: string;
}

export interface StuckSweepResult {
  /** Rows past the age threshold that were examined. */
  checked: number;
  completed: number;
  failed: number;
  /** Rows the chain could not explain. Left untouched, for a human. */
  unresolved: StuckRowReport[];
}

/** Rows are only ever advanced to a state the chain reports. */
type Resolved = 'completed' | 'failed';

/**
 * Advances one row to a terminal state, but only if it is still `processing`.
 *
 * Returns true when this call performed the transition, so the audit row is
 * written exactly once even if two sweeps race.
 */
async function resolveRow(
  id: string,
  userId: string,
  txHash: string,
  to: Resolved,
  blockNumber: bigint
): Promise<boolean> {
  const now = new Date();

  const { count } = await prisma.transaction.updateMany({
    where: { id, status: 'processing' },
    data:
      to === 'completed'
        ? { status: 'completed', blockNumber, settledAt: now }
        : { status: 'failed', blockNumber, failedAt: now },
  });

  if (count === 0) return false;

  await logAuditEvent({
    userId,
    action: to === 'completed' ? 'transaction.confirm' : 'transaction.fail',
    txHash,
    metadata: {
      blockNumber: blockNumber.toString(),
      // Provenance: distinguishes a sweep from the inline confirmation, so the
      // trail shows how a row reached its terminal state.
      resolvedBy: 'stuck-sweep',
    },
  });

  return true;
}

/**
 * Runs one sweep. Never throws for a single bad row: a row that cannot be read
 * is reported in `unresolved` and the sweep continues, because one unreadable
 * hash must not stall every other stuck payment.
 */
export async function sweepStuckTransactions(): Promise<StuckSweepResult> {
  const cutoff = new Date(Date.now() - env.STUCK_TX_AGE_MINUTES * 60_000);

  const stuck = await prisma.transaction.findMany({
    where: {
      status: 'processing',
      txHash: { not: null },
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: 'asc' },
    take: env.STUCK_TX_SWEEP_LIMIT,
    select: { id: true, userId: true, txHash: true, createdAt: true, network: true },
  });

  const result: StuckSweepResult = {
    checked: stuck.length,
    completed: 0,
    failed: 0,
    unresolved: [],
  };

  for (const row of stuck) {
    const txHash = row.txHash as string;
    const ageMinutes = Math.round((Date.now() - row.createdAt.getTime()) / 60_000);

    try {
      // The ROW's network, not the deployment's. A practice payment's hash does not
      // exist on the live chain, so reading the served chain returns "not found"
      // forever and leaves the row `processing` for good — the state that makes a
      // customer's Activity disagree with the chain indefinitely.
      const receipt = await getTransactionReceipt(
        txHash as Hex,
        normalizeNetwork(row.network, servedNetwork)
      );

      const to: Resolved = receipt.status === 'success' ? 'completed' : 'failed';
      if (await resolveRow(row.id, row.userId, txHash, to, receipt.blockNumber)) {
        if (to === 'completed') result.completed += 1;
        else result.failed += 1;
      }
    } catch {
      // Only the shortMessage/code matters here and neither is printed, so this
      // cannot leak the provider URL the way a raw viem error would.
      result.unresolved.push({
        id: row.id,
        txHash,
        ageMinutes,
        reason: 'no receipt for a row that was written after a successful one',
      });
    }
  }

  lastSweep = { at: new Date(), result };

  return result;
}

/**
 * The most recent pass, held in memory.
 *
 * Per-process on purpose: it answers "is this process sweeping, and is anything
 * unresolved", which is what a probe needs. It is not a metrics store — nothing
 * survives a restart, and with several replicas each reports its own last pass.
 */
let lastSweep: { at: Date; result: StuckSweepResult } | null = null;

/**
 * No sweep within this window means the sweep is not running.
 *
 * The indexer ticks every 15s, so a minute of silence is four missed passes: a
 * stopped sweep is the failure that matters most, because a dead sweep looks
 * exactly like a quiet one.
 */
const SWEEP_STALE_AFTER_MS = 60_000;

export interface SweepHealth {
  lastSweepAt: string | null;
  lastSweepAgeSeconds: number | null;
  lastResult: {
    checked: number;
    completed: number;
    failed: number;
    unresolved: number;
  } | null;
  /** Rows past the age threshold right now: the sweep's candidate set. */
  awaitingSweep: number;
  oldestAwaitingMinutes: number | null;
  degraded: boolean;
  reasons: string[];
}

/**
 * Sweep health for the readiness probe (`GET /health/sweep`).
 *
 * Deliberately reports **counts, not hashes**: the probe is unauthenticated, and
 * a stuck-payment signal does not need to publish which payments they are.
 */
export async function getSweepStatus(): Promise<SweepHealth> {
  const cutoff = new Date(Date.now() - env.STUCK_TX_AGE_MINUTES * 60_000);

  const awaitingWhere = {
    status: 'processing' as const,
    txHash: { not: null },
    createdAt: { lt: cutoff },
  };

  const [awaitingSweep, oldest] = await Promise.all([
    prisma.transaction.count({ where: awaitingWhere }),
    prisma.transaction.findFirst({
      where: awaitingWhere,
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  const lastSweepAgeSeconds = lastSweep
    ? Math.round((Date.now() - lastSweep.at.getTime()) / 1000)
    : null;
  const unresolved = lastSweep?.result.unresolved.length ?? 0;
  const oldestAwaitingMinutes = oldest
    ? Math.round((Date.now() - oldest.createdAt.getTime()) / 60_000)
    : null;

  const reasons: string[] = [];

  if (lastSweep === null) {
    reasons.push('the sweep has not run since this process started');
  } else if (lastSweepAgeSeconds !== null && lastSweepAgeSeconds * 1000 > SWEEP_STALE_AFTER_MS) {
    reasons.push(`the sweep has not run for ${lastSweepAgeSeconds}s`);
  }

  if (unresolved > 0) {
    reasons.push(
      `${unresolved} transaction(s) the chain cannot explain — these need a human, ` +
        'see support:payment --stuck'
    );
  }

  // Only call a row overdue when the sweep is demonstrably running: in the
  // seconds between a row crossing the threshold and the next tick, a row is
  // legitimately still awaiting it, and a probe that flaps on that is useless.
  const sweepIsCurrent =
    lastSweep !== null &&
    lastSweepAgeSeconds !== null &&
    lastSweepAgeSeconds * 1000 <= SWEEP_STALE_AFTER_MS;

  if (
    sweepIsCurrent &&
    awaitingSweep > 0 &&
    oldestAwaitingMinutes !== null &&
    oldestAwaitingMinutes >= env.STUCK_TX_AGE_MINUTES + 2
  ) {
    reasons.push(
      `${awaitingSweep} row(s) past the ${env.STUCK_TX_AGE_MINUTES}m threshold are still unresolved`
    );
  }

  return {
    lastSweepAt: lastSweep ? lastSweep.at.toISOString() : null,
    lastSweepAgeSeconds,
    lastResult: lastSweep
      ? {
          checked: lastSweep.result.checked,
          completed: lastSweep.result.completed,
          failed: lastSweep.result.failed,
          unresolved,
        }
      : null,
    awaitingSweep,
    oldestAwaitingMinutes,
    degraded: reasons.length > 0,
    reasons,
  };
}
