import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

/**
 * Durable, single-writer indexer cursor.
 *
 * Why this is in Postgres rather than a module-level variable:
 *
 * - Restart safety. An in-memory cursor resets to 0, so every deploy re-scans
 *   a lookback window and re-derives state that is already recorded.
 * - Single writer. Two replicas each holding their own `lastBlock` will both
 *   scan the same range and race on writes. The advisory lock below makes the
 *   cursor the coordination point: whoever holds it is the one scanning.
 *
 * The lock is best-effort and self-healing. It is not a correctness boundary
 * for settlement — the Transaction table's unique txHash is that — it exists to
 * stop duplicated work and duplicated audit noise.
 */

/** Identifies this process for lock ownership. */
export const REPLICA_ID = randomUUID();

/** A lock older than this is treated as abandoned by a crashed replica. */
export const LOCK_TTL_MS = 60_000;

export interface CursorState {
  lastBlock: bigint;
  lockedBy: string | null;
  lockedAt: Date | null;
}

/**
 * Reads the cursor, creating the row on first use.
 *
 * Returns lastBlock 0n for a fresh chain, which the caller must treat as
 * "no cursor yet" and bootstrap from a lookback window.
 */
export async function readCursor(chain: string): Promise<CursorState> {
  const row = await prisma.indexerCursor.upsert({
    where: { chain },
    update: {},
    create: { chain },
  });

  return {
    lastBlock: row.lastBlock,
    lockedBy: row.lockedBy,
    lockedAt: row.lockedAt,
  };
}

/**
 * Attempts to acquire the scan lock for this replica.
 *
 * Succeeds when the lock is free, already ours, or stale past LOCK_TTL_MS.
 * Returns false when another live replica holds it — the caller should skip
 * this tick rather than block.
 *
 * The upsert-before-update matters: `updateMany` matches zero rows when the
 * cursor row does not exist yet, so a chain that has never been scanned would
 * silently fail to acquire forever. Creating the row here makes the lock
 * self-provisioning.
 */
export async function tryAcquireLock(
  chain: string,
  replicaId: string = REPLICA_ID,
  ttlMs: number = LOCK_TTL_MS
): Promise<boolean> {
  await ensureCursorRow(chain);

  const now = new Date();
  const staleBefore = new Date(now.getTime() - ttlMs);

  // updateMany with a WHERE clause makes this a single atomic compare-and-set:
  // Postgres evaluates the predicate under a row lock, so two replicas racing
  // here cannot both match. A plain read-then-write would let them both win.
  const { count } = await prisma.indexerCursor.updateMany({
    where: {
      chain,
      OR: [
        { lockedBy: null },
        { lockedBy: replicaId },
        // Reclaim a lock whose holder never released it.
        { lockedAt: { lt: staleBefore } },
      ],
    },
    data: { lockedBy: replicaId, lockedAt: now },
  });

  return count > 0;
}

/** Creates the cursor row if absent. Idempotent and safe to race. */
async function ensureCursorRow(chain: string): Promise<void> {
  await prisma.indexerCursor.upsert({
    where: { chain },
    update: {},
    create: { chain },
  });
}

/**
 * Advances the cursor and releases the lock in one statement.
 *
 * Only writes when this replica still owns the lock. If the lock was reclaimed
 * by another replica mid-scan, the update matches nothing and the stale
 * replica cannot clobber the newer cursor.
 */
export async function advanceCursor(
  chain: string,
  lastBlock: bigint,
  replicaId: string = REPLICA_ID
): Promise<boolean> {
  const { count } = await prisma.indexerCursor.updateMany({
    where: { chain, lockedBy: replicaId },
    data: { lastBlock, lockedBy: null, lockedAt: null },
  });

  return count > 0;
}

/** Releases the lock without advancing, e.g. when a scan threw. */
export async function releaseLock(chain: string, replicaId: string = REPLICA_ID): Promise<void> {
  await prisma.indexerCursor.updateMany({
    where: { chain, lockedBy: replicaId },
    data: { lockedBy: null, lockedAt: null },
  });
}
