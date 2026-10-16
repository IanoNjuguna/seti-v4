/**
 * Stuck-transaction sweep checks.
 *
 * Run with:  npm run check:stuck
 *
 * Requires live Postgres and an RPC.
 *
 * The sweep exists because a payment row can be written as `processing` and then
 * never advanced — `/transactions/pay` does the confirmation inline, so if that
 * request dies the row is orphaned, and until now nothing ever looked at it
 * again. These assertions pin the three things that make the fix trustworthy:
 *
 *  - a settled payment is actually resolved (anchored on a REAL successful
 *    transfer, not a fabricated hash — "no receipt" trivially satisfies a
 *    do-nothing sweep);
 *  - a row still inside the age window is left alone, so the sweep cannot race
 *    a confirmation that is still in flight;
 *  - a row the chain cannot explain is reported and NEVER rewritten, because
 *    inventing a terminal state there would hide a reorg or a wrong-chain hash.
 *
 * Plus idempotency: a second sweep must not re-advance or re-audit a row.
 */
import { parseAbiItem, type Hex } from 'viem';
import { prisma } from '../lib/prisma.js';
import { getTokenContract, publicClient, servedNetwork } from './chain.js';
import { env } from '../config/env.js';
import { sweepStuckTransactions, getSweepStatus } from './stuck-transactions.js';

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

/** A real successful transfer, to anchor the "chain settled it" case. */
async function findRecentTransfer(): Promise<string | null> {
  const head = await publicClient.getBlockNumber();

  // 10-block chunks: Alchemy's free tier rejects wider eth_getLogs ranges on
  // Tempo mainnet, so one wide query would fail outright on the chain this
  // matters most for.
  for (let end = head; end > head - 400n; end -= 10n) {
    try {
      const logs = await publicClient.getLogs({
        address: getTokenContract('ousd'),
        event: transferEvent,
        fromBlock: end - 9n > 0n ? end - 9n : 0n,
        toBlock: end,
      });
      if (logs.length > 0) return logs[0].transactionHash;
    } catch {
      // Provider refused this chunk (range cap or transient); try the next.
    }
  }

  return null;
}

/** A well-formed hash that does not exist on chain. */
const MISSING_HASH = '0x' + '77'.repeat(32);

/** Backdates a row past the sweep's age threshold. */
function staleDate(): Date {
  return new Date(Date.now() - (env.STUCK_TX_AGE_MINUTES + 5) * 60_000);
}

/**
 * Removes this suite's fixtures by their fixed identity.
 *
 * By identity rather than by a captured id, so it is idempotent and callable
 * from a crash handler: a crash can happen before an id is in scope, and the
 * point is that the next run starts clean.
 */
async function teardown(): Promise<void> {
  const merchants = await prisma.merchant.findMany({
    where: { name: { in: ['Stuck Sweep Check Merchant'] } },
    select: { id: true },
  });
  const merchantIds = merchants.map((merchant) => merchant.id);

  // Transactions before merchants and before wallets: the merchant FK is
  // ON DELETE SET NULL (so deleting the merchant first would strand the payment
  // row rather than remove it) and the wallet FK is RESTRICT.
  if (merchantIds.length > 0) {
    await prisma.transaction.deleteMany({ where: { merchantId: { in: merchantIds } } });
  }

  const user = await prisma.user.findUnique({ where: { email: 'stuck-check@seti.test' } });
  if (user) {
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.wallet.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  if (merchantIds.length > 0) {
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
  }
}

/** `teardown`, but it never masks the error that got us here. */
async function teardownSafely(): Promise<void> {
  try {
    await teardown();
  } catch (error) {
    console.error('fixture teardown failed:', error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log(
    `sweep threshold: ${env.STUCK_TX_AGE_MINUTES}m   limit: ${env.STUCK_TX_SWEEP_LIMIT}`
  );

  const anchor = await findRecentTransfer();
  console.log(
    anchor
      ? `anchoring on real OUSD transfer: ${anchor}`
      : `no recent OUSD transfer found; the "settled row is resolved" case will be skipped`
  );

  const preExisting = await prisma.transaction.count({ where: { status: 'processing' } });
  if (preExisting > 0) {
    console.log(
      `note: ${preExisting} row(s) are already in processing in this database; the sweep is` +
        ` limited to ${env.STUCK_TX_SWEEP_LIMIT} per pass and may examine those first`
    );
  }

  const user = await prisma.user.upsert({
    where: { email: 'stuck-check@seti.test' },
    update: {},
    create: { email: 'stuck-check@seti.test' },
  });

  const wallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      chain: 'tempo',
      asset: 'ousd',
      address: `0xstuck${Date.now()}`,
    },
  });

  const merchant = await prisma.merchant.create({
    data: {
      name: 'Stuck Sweep Check Merchant',
      payoutAddress: '0x000000000000000000000000000000000000dEaD',
    },
  });

  const base = {
    userId: user.id,
    walletId: wallet.id,
    type: 'payment' as const,
    status: 'processing' as const,
    amount: '10',
    asset: 'ousd',
    merchantId: merchant.id,
    /**
     * The row's OWN network — the served one, because that is where the anchor
     * transaction below lives. This used to be left to the schema default, so every
     * fixture row claimed `testnet` while resolving against a live-money anchor; the
     * sweep reads on the row's network now, and a fixture that lies about its
     * network would fail for the wrong reason.
     */
    network: servedNetwork,
  };

  // --- A: a settled payment the database never heard about -----------------
  const settled = anchor
    ? await prisma.transaction.create({
        data: {
          ...base,
          txHash: anchor,
          counterparty: 'mesh-check-anchor',
          createdAt: staleDate(),
        },
      })
    : null;

  // --- B: still inside the age window (negative control) -------------------
  // Same shape as A but too young to touch. If the threshold were not honoured
  // this row would be resolved while its confirmation was still in flight.
  const fresh = await prisma.transaction.create({
    data: {
      ...base,
      txHash: MISSING_HASH,
      counterparty: 'mesh-check-fresh',
    },
  });

  // --- C: past the window and unresolvable --------------------------------
  const unresolvable = await prisma.transaction.create({
    data: {
      ...base,
      txHash: '0x' + '88'.repeat(32),
      counterparty: 'mesh-check-missing',
      createdAt: staleDate(),
    },
  });

  // --- D: already terminal -------------------------------------------------
  const terminal = await prisma.transaction.create({
    data: {
      ...base,
      status: 'completed',
      txHash: '0x' + '99'.repeat(32),
      counterparty: 'mesh-check-terminal',
      settledAt: new Date(),
      createdAt: staleDate(),
    },
  });

  const sweep = await sweepStuckTransactions();
  console.log(
    `\nsweep: checked ${sweep.checked}, completed ${sweep.completed}, ` +
      `failed ${sweep.failed}, unresolved ${sweep.unresolved.length}\n`
  );

  if (sweep.checked >= env.STUCK_TX_SWEEP_LIMIT) {
    console.log(
      `warning: the sweep hit its ${env.STUCK_TX_SWEEP_LIMIT}-row limit, so other rows may have` +
        ' crowded out these fixtures — treat a failure below as possible saturation, not a bug'
    );
  }

  // --- the alerting surface ------------------------------------------------
  // `GET /health/sweep` turns this into a 503, which is the only paging this
  // service has. If the payload stops carrying the signal, the probe goes quiet
  // and a stuck payment becomes invisible again.
  const health = await getSweepStatus();
  check(
    'health reports the unresolved row',
    health.lastResult !== null && health.lastResult.unresolved >= 1,
    `unresolved=${health.lastResult?.unresolved ?? 'n/a'}`
  );
  check('health degrades when a row needs a human', health.degraded, health.reasons.join('; '));
  check(
    'health states why it degraded',
    health.reasons.some((reason) => reason.includes('cannot explain')),
    health.reasons[0] ?? 'no reason given'
  );
  check('health records when the sweep last ran', health.lastSweepAgeSeconds !== null);
  check(
    'health publishes counts, not hashes',
    !JSON.stringify(health).includes('0x'),
    'an unauthenticated probe must not publish which payments are stuck'
  );

  const auditFor = (txHash: string, action: string) =>
    prisma.auditLog.count({ where: { userId: user.id, txHash, action } });

  if (settled) {
    const after = await prisma.transaction.findUniqueOrThrow({ where: { id: settled.id } });
    const receipt = await publicClient.getTransactionReceipt({ hash: anchor as Hex });

    check('settled payment is advanced out of processing', after.status === 'completed', after.status);
    check('resolution stamps settledAt', after.settledAt !== null);
    check(
      'resolution records the chain block',
      after.blockNumber === receipt.blockNumber,
      `${after.blockNumber} vs ${receipt.blockNumber}`
    );
    check(
      'resolution is audited against the txHash',
      (await auditFor(anchor as string, 'transaction.confirm')) === 1
    );

    const [auditRow] = await prisma.auditLog.findMany({
      where: { userId: user.id, txHash: anchor as string },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    check(
      'the audit row says the sweep did it, not the inline confirmation',
      (auditRow?.metadata as { resolvedBy?: string } | null)?.resolvedBy === 'stuck-sweep'
    );
  } else {
    console.log('skip  settled-row case (no on-chain transfer to anchor on)');
  }

  // --- the negative control -----------------------------------------------
  const freshAfter = await prisma.transaction.findUniqueOrThrow({ where: { id: fresh.id } });
  check(
    'a row inside the age window is left alone',
    freshAfter.status === 'processing',
    freshAfter.status
  );
  check('an untouched row is not stamped with settledAt', freshAfter.settledAt === null);
  check(
    'a row inside the age window is not even reported',
    !sweep.unresolved.some((row) => row.id === fresh.id)
  );

  // --- unresolvable rows are reported, never rewritten --------------------
  const unresolvableAfter = await prisma.transaction.findUniqueOrThrow({
    where: { id: unresolvable.id },
  });
  check(
    'an unreadable receipt does NOT invent a terminal state',
    unresolvableAfter.status === 'processing',
    unresolvableAfter.status
  );
  const report = sweep.unresolved.find((row) => row.id === unresolvable.id);
  check('the unresolvable row is reported for a human', report !== undefined);
  check(
    'the report carries the hash and the age',
    report?.txHash === unresolvable.txHash && (report?.ageMinutes ?? 0) >= env.STUCK_TX_AGE_MINUTES,
    report ? `${report.ageMinutes}m` : 'no report'
  );

  // --- terminal rows are never rewritten or re-audited --------------------
  const terminalAfter = await prisma.transaction.findUniqueOrThrow({ where: { id: terminal.id } });
  check(
    'a terminal row is left exactly as it was',
    terminalAfter.status === 'completed' && terminalAfter.settledAt !== null
  );
  check(
    'a terminal row gains no audit entry from the sweep',
    (await auditFor(terminal.txHash as string, 'transaction.confirm')) === 0
  );

  // --- idempotency: the conditional update is the safety story -------------
  const second = await sweepStuckTransactions();
  if (settled) {
    const afterSecond = await prisma.transaction.findUniqueOrThrow({ where: { id: settled.id } });
    check(
      'a second sweep does not re-open or re-advance a resolved row',
      afterSecond.status === 'completed'
    );
    check(
      'a second sweep writes no second audit entry',
      (await auditFor(anchor as string, 'transaction.confirm')) === 1,
      `${second.checked} re-checked`
    );
  }

  await teardown();

  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('stuck-sweep check crashed:', error);
  // Tear down even on a crash: a fixture left in `processing` would also be a
  // fixture the running indexer's sweep would then resolve and audit, which
  // makes the next run's evidence harder to read.
  await teardownSafely();
  await prisma.$disconnect();
  process.exit(1);
});
