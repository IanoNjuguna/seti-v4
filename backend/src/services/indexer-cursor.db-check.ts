/**
 * Durable cursor + lock checks against live Postgres.
 *
 * Run with:  npm run check:cursor
 * Requires:  docker compose up -d (in backend/)
 *
 * The lock is the part that cannot be proven with pure functions: mutual
 * exclusion depends on Postgres evaluating the WHERE clause under a row lock,
 * so it has to be exercised against a real database.
 *
 * IMPORTANT: every row this file touches uses a throwaway chain key
 * (`check-cursor-*`). It must never read, write, or delete the real
 * `tempo-mainnet` / `tempo-testnet` cursor rows — those hold live indexing
 * progress on whichever chain is configured, and clobbering them silently
 * resets production state to 0.
 */
import { prisma } from '../lib/prisma.js';
import {
  advanceCursor,
  readCursor,
  releaseLock,
  tryAcquireLock,
} from './indexer-store.js';

// Throwaway keys. NOT 'tempo-mainnet' / 'tempo-testnet' — those are the real
// cursors for whichever chain is live, and this file deletes rows on cleanup.
const CHAIN = 'check-cursor-a';
const CHAIN_2 = 'check-cursor-b';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)} ${String(actual)}${ok ? '' : ` (expected ${String(expected)})`}`);
}

async function main() {
  await prisma.indexerCursor.deleteMany({ where: { chain: { in: [CHAIN, CHAIN_2] } } });

  // --- Fresh cursor --------------------------------------------------------
  const fresh = await readCursor(CHAIN);
  check('fresh cursor starts at 0', fresh.lastBlock, 0n);
  check('fresh cursor is unlocked', fresh.lockedBy, null);

  // --- Mutual exclusion ----------------------------------------------------
  check('replica A acquires the lock', await tryAcquireLock(CHAIN, 'replica-a'), true);
  check('replica B is refused', await tryAcquireLock(CHAIN, 'replica-b'), false);
  check('replica A re-acquiring is idempotent', await tryAcquireLock(CHAIN, 'replica-a'), true);

  // --- Only the owner may advance -----------------------------------------
  check('replica B cannot advance', await advanceCursor(CHAIN, 500n, 'replica-b'), false);
  const afterB = await readCursor(CHAIN);
  check('cursor unchanged after B tried', afterB.lastBlock, 0n);

  check('replica A advances', await advanceCursor(CHAIN, 500n, 'replica-a'), true);
  const afterA = await readCursor(CHAIN);
  check('cursor advanced to 500', afterA.lastBlock, 500n);
  check('advance released the lock', afterA.lockedBy, null);

  // --- Resume, not restart-from-zero --------------------------------------
  check('replica B now acquires (lock free)', await tryAcquireLock(CHAIN, 'replica-b'), true);
  check('replica B resumes from 500', (await readCursor(CHAIN)).lastBlock, 500n);
  await releaseLock(CHAIN, 'replica-b');

  // --- Stale lock reclaim --------------------------------------------------
  // Simulate a crashed replica: lock held with an old timestamp.
  await prisma.indexerCursor.update({
    where: { chain: CHAIN },
    data: { lockedBy: 'dead-replica', lockedAt: new Date(Date.now() - 10 * 60_000) },
  });
  check('stale lock is reclaimable', await tryAcquireLock(CHAIN, 'replica-c'), true);
  check('new holder recorded', (await readCursor(CHAIN)).lockedBy, 'replica-c');
  await releaseLock(CHAIN, 'replica-c');

  // --- Fresh lock is NOT reclaimable --------------------------------------
  await prisma.indexerCursor.update({
    where: { chain: CHAIN },
    data: { lockedBy: 'live-replica', lockedAt: new Date() },
  });
  check('fresh lock held by a live replica', await tryAcquireLock(CHAIN, 'replica-d'), false);

  // --- Chains are independent ---------------------------------------------
  check('other chain acquires independently', await tryAcquireLock(CHAIN_2, 'replica-a'), true);

  // --- A stale holder must not clobber a newer cursor ----------------------
  await prisma.indexerCursor.update({
    where: { chain: CHAIN },
    data: { lastBlock: 900n, lockedBy: 'replica-e', lockedAt: new Date() },
  });
  // replica-e's lock went stale and replica-f took over, advancing to 1000.
  await prisma.indexerCursor.update({
    where: { chain: CHAIN },
    data: { lockedAt: new Date(Date.now() - 10 * 60_000) },
  });
  await tryAcquireLock(CHAIN, 'replica-f');
  await advanceCursor(CHAIN, 1000n, 'replica-f');
  // Now the original holder returns late and tries to write its stale value.
  check('late stale holder cannot clobber', await advanceCursor(CHAIN, 900n, 'replica-e'), false);
  check('cursor still at the newer value', (await readCursor(CHAIN)).lastBlock, 1000n);

  await prisma.indexerCursor.deleteMany({ where: { chain: { in: [CHAIN, CHAIN_2] } } });
  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('cursor check crashed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
