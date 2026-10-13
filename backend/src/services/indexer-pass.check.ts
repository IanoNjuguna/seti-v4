/**
 * Indexer pass checks against live Postgres.
 *
 * Run with:  npm run check:indexer-pass
 *
 * These cover `indexOnce`'s orchestration, which the pure-function cursor checks
 * cannot reach. That gap is not hypothetical: the "cursor never advances from 0"
 * bug lived entirely in this layer — `resolveBlockWindow` correctly returned an
 * empty window, and the caller returned without persisting anything, so the
 * indexer silently idled forever. A test on the window maths alone would have
 * passed while the indexer indexed nothing.
 *
 * Every pass here runs against a throwaway chain key, and that is the fix for
 * two separate incidents rather than tidiness:
 *
 *  1. A cleanup bug once deleted the LIVE `tempo-mainnet` row, silently resetting
 *     real indexing progress to 0 while the suite reported success.
 *  2. Driving the live key also meant competing for the live lock, so a
 *     concurrently running indexer (a dev server ticking every 15s) could win it
 *     mid-test and turn a real pass into `locked-by-other-replica` — two
 *     assertions failing at random on an otherwise green tree, with a cause that
 *     looked nothing like the code under test.
 *
 * `indexOnce(chainKey)` takes the key as an argument for exactly this reason.
 * The pass logic is key-agnostic, so the same orchestration is exercised without
 * reading, locking, writing or deleting anything live.
 *
 * The RPC is not stubbed: indexOnce reads the chain head for the configured
 * network, so these assertions are relative to the actual head rather than
 * hardcoded block numbers.
 */
import { prisma } from '../lib/prisma.js';
import { network } from '../config/networks.js';
import { indexOnce } from './indexer.js';
import {
  advanceCursor,
  readCursor,
  releaseLock,
  tryAcquireLock,
  REPLICA_ID,
} from './indexer-store.js';

const LIVE_KEY = network.name;
const SAFE_PREFIX = 'check-indexer-pass-';
/** The one throwaway key every pass in this file runs against. */
const FIXTURE_KEY = `${SAFE_PREFIX}fixture`;
/** Identifies this suite when it seeds the fixture row. */
const SETUP_REPLICA = `${SAFE_PREFIX}setup`;

/**
 * The chain names the buggy versions of these suites used as fixtures. Asserted
 * absent so a stray row from an old run cannot be mistaken for live state.
 */
const SAFE_LEGACY_KEYS = ['check-cursor-a', 'check-cursor-b'];

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

async function head(): Promise<bigint> {
  const { publicClient } = await import('./chain.js');
  return publicClient.getBlockNumber();
}

/**
 * Runs `fn` against the fixture cursor seeded at `seed`, then removes the row
 * whatever happens — including when an assertion throws — so a failed run cannot
 * leave state behind for the next one to misread.
 */
async function withFixtureCursor<T>(seed: bigint, fn: () => Promise<T>): Promise<T> {
  await prisma.indexerCursor.deleteMany({ where: { chain: FIXTURE_KEY } });

  // advanceCursor only writes while the caller owns the lock, so take it first.
  // It releases the lock as part of the same statement.
  await tryAcquireLock(FIXTURE_KEY, SETUP_REPLICA);
  await advanceCursor(FIXTURE_KEY, seed, SETUP_REPLICA);

  try {
    return await fn();
  } finally {
    await releaseLock(FIXTURE_KEY).catch(() => undefined);
    await prisma.indexerCursor.deleteMany({ where: { chain: FIXTURE_KEY } });
  }
}

async function main() {
  const chainHead = await head();
  console.log(`network       : ${network.name} (${network.chainId})`);
  console.log(`chain head    : ${chainHead}`);
  console.log(`fixture key   : ${FIXTURE_KEY} (the live ${LIVE_KEY} row is never touched)`);

  const liveBefore = await prisma.indexerCursor.findUnique({ where: { chain: LIVE_KEY } });

  // --- Regression: a fresh cursor must establish a baseline ---------------
  //
  // With lastBlock = 0 the scan window is empty (correct — we refuse to ingest
  // history). The pass must still persist the head so the NEXT pass has a real
  // starting point. If this regresses, the indexer idles at 0 forever and no
  // payment is ever indexed.
  console.log('\nfresh cursor (lastBlock = 0):');
  const fresh = await withFixtureCursor(0n, async () => {
    const first = await indexOnce(FIXTURE_KEY);
    const cursorAfterFirst = await readCursor(FIXTURE_KEY);

    // Second pass, now that a baseline exists, must be a no-op if the chain has
    // not moved.
    const second = await indexOnce(FIXTURE_KEY);
    const cursorAfterSecond = await readCursor(FIXTURE_KEY);

    return { first, cursorAfterFirst, second, cursorAfterSecond };
  });

  check(
    'fresh cursor advances to a real block (not 0)',
    fresh.cursorAfterFirst.lastBlock > 0n,
    `lastBlock=${fresh.cursorAfterFirst.lastBlock}`
  );
  check(
    'baseline is at or near the chain head (no history ingested)',
    fresh.cursorAfterFirst.lastBlock >= chainHead - 200n,
    `head=${chainHead} cursor=${fresh.cursorAfterFirst.lastBlock}`
  );
  check('first pass is not reported as skipped', fresh.first.skipped === false);
  check('first pass is flagged as a bootstrap', fresh.first.bootstrap === true);
  check(
    'second pass on a caught-up cursor does not move backwards',
    fresh.cursorAfterSecond.lastBlock >= fresh.cursorAfterFirst.lastBlock,
    `${fresh.cursorAfterSecond.lastBlock} >= ${fresh.cursorAfterFirst.lastBlock}`
  );
  check(
    'the fixture row is removed after the pass',
    (await prisma.indexerCursor.count({ where: { chain: FIXTURE_KEY } })) === 0
  );

  // --- Regression: a cursor at the head must not rescan -------------------
  console.log('\ncursor at head:');
  const atHead = await withFixtureCursor(chainHead, async () => {
    const pass = await indexOnce(FIXTURE_KEY);
    const cursor = await readCursor(FIXTURE_KEY);
    return { pass, cursor };
  });

  check('pass at head is not skipped', atHead.pass.skipped === false);
  // When nothing is scanned the pass reports a degenerate from==to marker rather
  // than the raw (inverted) window, so assert the cursor held steady and no work
  // was claimed — not the internal window shape.
  check(
    'nothing scanned: pass reports a zero-width range',
    atHead.pass.fromBlock === atHead.pass.toBlock,
    `${atHead.pass.fromBlock} == ${atHead.pass.toBlock}`
  );
  check(
    'cursor is not dragged backwards',
    atHead.cursor.lastBlock >= chainHead - 50n,
    `lastBlock=${atHead.cursor.lastBlock}`
  );

  // --- The lock still short-circuits a pass -------------------------------
  console.log('\nlock held by another replica:');
  const locked = await withFixtureCursor(chainHead, async () => {
    await tryAcquireLock(FIXTURE_KEY, 'some-other-replica');
    return indexOnce(FIXTURE_KEY);
  });
  check(
    'pass is skipped when another replica holds the lock',
    locked.skipped === true && locked.reason === 'locked-by-other-replica',
    String(locked.reason)
  );

  // --- Regression: checks must not touch the live cursor ------------------
  //
  // Bug 2: this suite previously used 'tempo-mainnet' as a fixture key and
  // deleted it on cleanup, which silently reset live indexing progress to 0.
  // These assertions pin the fix. Note what is deliberately NOT asserted: that
  // the live row is *unlocked*, because a real indexer may legitimately hold the
  // lock at this instant. What must hold is that this suite is not its holder.
  console.log('\nfixture isolation:');
  const liveAfter = await prisma.indexerCursor.findUnique({ where: { chain: LIVE_KEY } });

  if (liveBefore === null) {
    console.log(
      `skip  no live ${LIVE_KEY} cursor row exists yet (network never indexed)\n` +
        '      nothing to preserve; indexOnce will seed it on first run'
    );
    check('no live cursor row was created by these checks', liveAfter === null);
  } else {
    check(
      'live cursor still exists after the checks',
      liveAfter !== null,
      `${LIVE_KEY} @ ${liveAfter?.lastBlock ?? 'missing'}`
    );
    check(
      'live cursor was not reset to 0',
      liveAfter !== null && liveAfter.lastBlock > 0n,
      `lastBlock=${liveAfter?.lastBlock ?? 'missing'}`
    );
    check(
      'this suite does not hold the live lock',
      liveAfter?.lockedBy !== SETUP_REPLICA && liveAfter?.lockedBy !== REPLICA_ID,
      `lockedBy=${liveAfter?.lockedBy ?? 'null'}`
    );
  }

  check(
    'checks never leave a row matching the fixture prefix',
    (await prisma.indexerCursor.count({ where: { chain: { startsWith: SAFE_PREFIX } } })) === 0
  );
  check(
    'no cursor rows exist for the old unsafe fixture keys',
    (await prisma.indexerCursor.count({ where: { chain: { in: SAFE_LEGACY_KEYS } } })) === 0,
    SAFE_LEGACY_KEYS.join(', ')
  );

  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('indexer pass check crashed:', error);
  // Best-effort teardown: leave neither the fixture row nor a lock behind.
  await releaseLock(FIXTURE_KEY).catch(() => undefined);
  await prisma.indexerCursor.deleteMany({ where: { chain: FIXTURE_KEY } }).catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
