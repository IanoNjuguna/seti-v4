/**
 * Proof for the ledger's idempotency guard: `createTransactionOnce` (and the
 * money path built on it) must turn ONE repeated `(txHash, userId, network)` into
 * the row that is already there, and must still throw for a collision on any
 * OTHER unique index.
 *
 *   npx tsx src/cli/proof-transaction-idempotency.ts
 *
 * Three claims, and each is checked against the database rather than against what
 * the function says it did:
 *
 *  1. A second write of the same ledger key returns the EXISTING row
 *     (`created: false`) and leaves exactly one row — the original one, not a
 *     rewritten copy.
 *  2. The same through the real money path: `recordSend` runs twice against the
 *     pinned anchor receipt (read-only; the money moved long ago) and the second
 *     run neither throws nor writes a second ledger row or a second `send.recorded`
 *     audit entry.
 *  3. A P2002 on a DIFFERENT unique index still throws — here, a colliding
 *     primary key — so a real collision is never mistaken for a replay.
 *
 * Fixtures are torn down by their fixed identities, so this is rerunnable and
 * leaves nothing behind. It writes rows to the configured database ONLY for
 * accounts it creates itself.
 */
import 'dotenv/config';
import { getAddress, type Hex } from 'viem';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { isUniqueViolation, uniqueViolationColumns, violatesUniqueOn } from '../lib/unique-violation.js';
import { createTransactionOnce, recordSend } from '../services/transactions.js';
import { issueQuote } from '../services/quote.js';
import { env } from '../config/env.js';
import { servedNetwork, treasuryAddressFor, networkConfigFor } from '../config/networks.js';
import { getFxQuote } from '../services/payments.js';
import { deriveSendAnchor } from '../services/send-anchor.js';
import { publicClientFor } from '../services/chain.js';

const NETWORK = servedNetwork;
const CHECK_EMAIL = 'proof-tx-idempotency@seti.test';

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`ok    ${name}${detail ? `  ${detail}` : ''}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}${detail ? `  ${detail}` : ''}`);
  }
}

async function teardown(): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: CHECK_EMAIL } });
  if (!user) return;
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.deleteMany({ where: { userId: user.id } });
  await prisma.wallet.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

async function main(): Promise<void> {
  console.log(`network: ${networkConfigFor(NETWORK).displayName} (${NETWORK})`);
  console.log(`treasury: ${treasuryAddressFor(NETWORK)}\n`);

  await teardown();

  const user = await prisma.user.create({ data: { email: CHECK_EMAIL, network: NETWORK } });
  const wallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      chain: 'tempo',
      asset: 'usdt0',
      address: getAddress('0x0000000000000000000000000000000000009b9b'),
      status: 'active',
      network: NETWORK,
    },
  });

  const baseRow = {
    userId: user.id,
    walletId: wallet.id,
    network: NETWORK,
    type: 'p2p_send' as const,
    status: 'processing' as const,
    amount: '0.51000000',
    asset: 'usdt0',
    counterparty: getAddress('0x0000000000000000000000000000000000009c9c'),
    txHash: '0x' + 'ab'.repeat(32),
  };

  // --- 1. The ledger key is idempotent ------------------------------------
  console.log('the ledger key (txHash, userId, network):');

  const first = await createTransactionOnce({ data: baseRow });
  check('the first write creates the row', first.created === true, `id ${first.transaction.id}`);

  const second = await createTransactionOnce({
    // Same key, DIFFERENT figures on purpose: the guard must return what is
    // stored, not the new object it was handed.
    data: { ...baseRow, amount: '9.99000000', type: 'payment' },
  });
  check('a second write of the same key does not throw', true);
  check('it reports the row already existed (created: false)', second.created === false);
  check(
    'and returns the EXISTING row, not the new one',
    second.transaction.id === first.transaction.id,
    `${second.transaction.id} vs ${first.transaction.id}`
  );
  check(
    'the stored row is untouched by the replay',
    second.transaction.amount.toNumber() === 0.51 && second.transaction.type === 'p2p_send',
    `amount ${String(second.transaction.amount)}, type ${second.transaction.type}`
  );
  check(
    'exactly one row for the key',
    (await prisma.transaction.count({
      where: { txHash: baseRow.txHash, userId: user.id, network: NETWORK },
    })) === 1
  );

  // The classifier the guard is built on sees which index fired, so the branch
  // that decides "replay or real collision" is not a guess.
  console.log('\nthe violation it was refusing on:');
  let duplicate: unknown;
  try {
    await prisma.transaction.create({ data: baseRow });
  } catch (error) {
    duplicate = error;
  }
  check('a raw duplicate insert is a P2002', isUniqueViolation(duplicate));
  check(
    'and it names the ledger key, so the guard recognises it',
    violatesUniqueOn(duplicate, ['txHash', 'userId', 'network']),
    JSON.stringify(uniqueViolationColumns(duplicate))
  );

  // --- 2. A DIFFERENT unique index still throws ---------------------------
  console.log('\na collision on a different unique index:');

  // `Transaction.id` is unique (the primary key). Nothing about it is a ledger
  // key, so this must fall straight through the guard.
  const collidingId = await createTransactionOnce({
    data: {
      ...baseRow,
      id: first.transaction.id,
      txHash: '0x' + 'cd'.repeat(32),
    },
  }).then(
    () => null,
    (error: unknown) => error
  );

  check('the write is NOT swallowed as a replay', collidingId !== null);
  check(
    'it is the original P2002, rethrown untouched',
    isUniqueViolation(collidingId) && collidingId instanceof Prisma.PrismaClientKnownRequestError,
    isUniqueViolation(collidingId) ? `target ${JSON.stringify(uniqueViolationColumns(collidingId))}` : 'not a P2002'
  );
  check(
    'it is not mistaken for the ledger key',
    !violatesUniqueOn(collidingId, ['txHash', 'userId', 'network'])
  );
  check(
    'and no row was written',
    (await prisma.transaction.count({ where: { txHash: '0x' + 'cd'.repeat(32) } })) === 0
  );

  // --- 3. The real money path, replayed ----------------------------------
  //
  // `recordSend` against the pinned receipt twice. The receipt is history, so
  // nothing is signed or sent: this is the recording path exactly as a retry (or
  // an indexer that got there first) presents it.
  const anchorHash = (env.TEMPO_MAINNET_SEND_ANCHOR_TX ?? '').trim();

  if (NETWORK !== 'mainnet' || !anchorHash) {
    console.log('\nthe money path: SKIPPED (no mainnet send anchor pinned for this network).');
  } else {
    console.log('\nthe money path (recordSend, twice, on the pinned anchor):');

    const receipt = await publicClientFor(NETWORK).getTransactionReceipt({
      hash: anchorHash as Hex,
    });
    const anchor = deriveSendAnchor(receipt, NETWORK);
    const quote = await getFxQuote();

    // The row must name the wallet the RECEIPT says signed, or `recordSend`
    // refuses before it reaches the insert.
    const signer = await prisma.wallet.create({
      data: {
        userId: user.id,
        chain: 'tempo',
        asset: anchor.asset,
        address: getAddress(anchor.sender),
        status: 'deprecated',
        network: NETWORK,
      },
    });

    const input = {
      userId: user.id,
      network: NETWORK,
      amount: anchor.principal,
      asset: anchor.asset,
      recipient: getAddress(anchor.recipient),
      txHash: anchorHash,
      walletAddress: signer.address,
      quoteId: issueQuote({
        userId: user.id,
        network: NETWORK,
        fiatCurrency: quote.fiatCurrency,
        fiatPerUsd: quote.fiatPerUsd,
        source: quote.source,
        asOf: quote.asOf,
      }),
    };

    const recorded = await recordSend(input);
    check('the first record succeeds', recorded.txHash === anchorHash, `id ${recorded.id}`);

    const replayed = await recordSend(input).then(
      (row) => ({ ok: true as const, id: row.id }),
      (error: unknown) => ({ ok: false as const, error })
    );
    check(
      'a second record of the same send does NOT throw',
      replayed.ok,
      replayed.ok ? `id ${replayed.id}` : String(replayed.error)
    );
    check(
      'it returns the row that already exists',
      replayed.ok && replayed.id === recorded.id,
      replayed.ok ? `${replayed.id} vs ${recorded.id}` : 'threw'
    );
    check(
      'still exactly one ledger row for the send',
      (await prisma.transaction.count({
        where: { txHash: anchorHash, userId: user.id, network: NETWORK },
      })) === 1
    );
    check(
      'and exactly one send.recorded audit entry',
      (await prisma.auditLog.count({
        where: { userId: user.id, action: 'send.recorded', txHash: anchorHash },
      })) === 1
    );
  }

  await teardown();
  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? 'All proofs passed.' : `${failures} PROOF(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('proof crashed:', error);
  try {
    await teardown();
  } catch {
    // best effort
  }
  await prisma.$disconnect();
  process.exit(1);
});
