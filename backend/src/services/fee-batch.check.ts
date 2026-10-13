/**
 * Fee-leg reconciliation checks: in `batch` mode `recordPayment` must verify
 * BOTH transfers in the single receipt — principal to the merchant AND fee to
 * the treasury — and fail closed if either is missing.
 *
 * Run with:  FEE_ROUTING_MODE=batch npm run check:fee-batch
 *
 * Requires live Postgres and an RPC, because the whole point is that the
 * decision is driven by what the chain actually recorded. No mainnet batch has
 * been signed yet, so this drives the verification function directly rather
 * than through a real batched transaction, and it anchors on a real receipt to
 * prove the "missing leg" refusal is a genuine chain read rather than a stub.
 */
import { prisma } from '../lib/prisma.js';
import { decodeEventLog, erc20Abi, parseAbiItem } from 'viem';
import { recordPayment } from './transactions.js';
import { getFxQuote } from './payments.js';
import { issueQuote } from './quote.js';
import { formatUnits, getTokenContract, publicClient } from './chain.js';
import { env } from '../config/env.js';

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

/**
 * Finds a recent OUSD transfer, walking back in 10-block chunks because
 * Alchemy's free tier rejects wider ranges on Tempo mainnet.
 *
 * The search is deliberately wide. Real Tempo activity is frequently dust, and
 * a narrow window finds nothing and silently skips the batch guard — which is
 * the one check standing between the new fee path and a silently uncollected
 * fee. Widening costs RPC round-trips, so it walks back in bounded chunks and
 * stops at the first hit rather than always scanning the full range.
 */
async function findRecentOusdTransfer(): Promise<string | null> {
  const head = await publicClient.getBlockNumber();
  const CHUNK = 10n;
  const MAX_BLOCKS = 120_000n;

  for (let end = head; end > head - MAX_BLOCKS; end -= CHUNK) {
    try {
      const logs = await publicClient.getLogs({
        address: getTokenContract('ousd'),
        event: transferEvent,
        fromBlock: end - CHUNK + 1n > 0n ? end - CHUNK + 1n : 0n,
        toBlock: end,
      });
      if (logs.length > 0) return logs[0].transactionHash;
    } catch {
      // provider refused this chunk (range cap or transient); try the next
    }
  }

  return null;
}

/** Recipient and amount of the first OUSD transfer in a receipt. */
async function describeTransfer(txHash: string): Promise<{ to: string; value: number } | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
  const ousd = getTokenContract('ousd').toLowerCase();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ousd) continue;
    try {
      const decoded = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (decoded.eventName === 'Transfer') {
        return {
          to: String(decoded.args.to),
          value: Number(formatUnits(decoded.args.value, 6)),
        };
      }
    } catch {
      // ignore undecodable logs
    }
  }
  return null;
}

/**
 * Removes this suite's fixtures by their fixed identity.
 *
 * By identity rather than by a captured id, so it is idempotent and callable
 * from a crash handler and from the mid-run skip path: a crash can happen before
 * an id is in scope, and the point is that the next run starts clean.
 */
async function teardown(): Promise<void> {
  const merchants = await prisma.merchant.findMany({
    where: { name: { in: ['Fee Batch Check Merchant', 'Fee Batch Anchored Merchant'] } },
    select: { id: true },
  });
  const merchantIds = merchants.map((merchant) => merchant.id);

  // Transactions before merchants and before wallets: the merchant FK is
  // ON DELETE SET NULL (so deleting the merchant first would strand the payment
  // row rather than remove it) and the wallet FK is RESTRICT.
  if (merchantIds.length > 0) {
    await prisma.transaction.deleteMany({ where: { merchantId: { in: merchantIds } } });
  }

  const user = await prisma.user.findUnique({ where: { email: 'fee-batch-check@seti.test' } });
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
  if (env.FEE_ROUTING_MODE !== 'batch') {
    console.log(
      'skip  FEE_ROUTING_MODE is not "batch" — this check only covers the batch path.\n' +
        'Run it as: FEE_ROUTING_MODE=batch npm run check:fee-batch'
    );
    await prisma.$disconnect();
    process.exit(0);
  }

  const quote = await getFxQuote();
  console.log(`fee routing mode: ${env.FEE_ROUTING_MODE}`);
  console.log(`treasury: ${env.SETI_TREASURY_ADDRESS}`);
  console.log(`rate: ${quote.fiatPerUsd} (${quote.source})\n`);

  const user = await prisma.user.upsert({
    where: { email: 'fee-batch-check@seti.test' },
    update: {},
    create: { email: 'fee-batch-check@seti.test' },
  });

  // Fixture only: `teardown()` finds it through the user, so no id is needed here.
  //
  // The address must be a REAL 20-byte address (12 hex digits of timestamp + a
  // fixed tag, so a concurrent run cannot share the row): every `recordPayment`
  // below declares the wallet that signed, and an unusable declaration is refused
  // before the fee-leg check these cases are about. Nothing signs with it — all
  // of these calls are refused before the sender check.
  const SIGNING_ADDRESS = `0x${Date.now().toString(16).padStart(12, '0')}${'feeb'.repeat(7)}`;

  await prisma.wallet.upsert({
    where: { address: SIGNING_ADDRESS },
    update: {},
    create: {
      userId: user.id,
      chain: 'tempo',
      asset: 'ousd',
      address: SIGNING_ADDRESS,
    },
  });

  const merchant = await prisma.merchant.create({
    data: {
      name: 'Fee Batch Check Merchant',
      payoutAddress: '0x000000000000000000000000000000000000BEEF',
    },
  });

  /**
   * The rate is FROZEN at quote time: `recordPayment` above now needs a signed
   * quote. Issued from the same live rate this suite reads, so the fee-leg
   * guards these assertions exercise are reached exactly as before.
   */
  const quoteId = issueQuote({
    userId: user.id,
    fiatCurrency: quote.fiatCurrency,
    fiatPerUsd: quote.fiatPerUsd,
    source: quote.source,
    asOf: quote.asOf,
  });

  // Anchor on a REAL receipt that moves OUSD to a real address.
  //
  // A fabricated hash would make every refusal pass for the wrong reason:
  // "no receipt" satisfies a fail-closed assertion trivially, so the
  // merchant-leg check would throw before the fee-leg check ever ran and the
  // batch guard would appear to work while being untested. Pointing the merchant
  // at the genuine recipient means the merchant leg genuinely resolves and the
  // rejection can only come from the missing treasury leg.
  const realTx = await findRecentOusdTransfer();
  const realTransfer = realTx ? await describeTransfer(realTx) : null;

  if (!realTx || !realTransfer) {
    console.log('skip  no recent OUSD transfer found; cannot anchor the batch guard.');
    await teardown();
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`anchoring on real OUSD transfer: ${realTx}`);
  console.log(`  recipient ${realTransfer.to}, moved ${realTransfer.value} OUSD\n`);

  const anchoredMerchant = await prisma.merchant.create({
    data: { name: 'Fee Batch Anchored Merchant', payoutAddress: realTransfer.to },
  });

  // --- The principal leg present, fee leg missing --------------------------
  //
  // This is the exact shape of "merchant paid, fee vanished". Recording it as
  // settled would be the same uncollected-fee problem as before, just harder to
  // see. The claim matches the chain exactly, so the ONLY reason to refuse is
  // the absent fee leg.
  console.log('principal leg present, fee leg missing:');

  let threw = false;
  let message = '';
  try {
    await recordPayment({
      userId: user.id,
      amount: realTransfer.value.toFixed(8),
      asset: 'ousd',
      merchantId: anchoredMerchant.id,
      txHash: realTx,
      quoteId,
      walletAddress: SIGNING_ADDRESS,
    });
  } catch (error) {
    threw = true;
    message = error instanceof Error ? error.message : String(error);
  }

  check('a missing fee leg is refused', threw, message.slice(0, 90));
  check(
    'message names the fee leg, not a receipt failure',
    /fee leg/i.test(message),
    message.slice(0, 80)
  );
  check(
    'merchant leg itself did resolve (guard is not passing on a missing receipt)',
    !/receipt not available/i.test(message),
    message.slice(0, 60)
  );
  check(
    'no row written when the fee leg is missing',
    (await prisma.transaction.count({ where: { merchantId: anchoredMerchant.id } })) === 0
  );

  // --- Neither leg present is refused too ---------------------------------
  console.log('\nno leg present:');

  threw = false;
  message = '';
  try {
    await recordPayment({
      userId: user.id,
      amount: (250 / quote.fiatPerUsd).toFixed(8),
      asset: 'ousd',
      merchantId: merchant.id,
      txHash: '0x' + '44'.repeat(32),
      quoteId,
      walletAddress: SIGNING_ADDRESS,
    });
  } catch (error) {
    threw = true;
    message = error instanceof Error ? error.message : String(error);
  }
  check('an absent principal leg is refused', threw, message.slice(0, 80));
  check(
    'still no row written',
    (await prisma.transaction.count({ where: { merchantId: merchant.id } })) === 0
  );

  // --- The treasury address must be a real, distinct recipient ------------
  //
  // If the treasury were unset or equal to the merchant, the two legs would
  // collapse into one and the fee would silently vanish. env validates the
  // format at boot; assert the properties the batch depends on.
  console.log('\ntreasury configuration:');
  check(
    'treasury is a 20-byte hex address',
    /^0x[a-fA-F0-9]{40}$/.test(env.SETI_TREASURY_ADDRESS)
  );
  check(
    'treasury is not the zero address',
    env.SETI_TREASURY_ADDRESS.toLowerCase() !== '0x' + '0'.repeat(40)
  );
  check(
    'treasury differs from the merchant payout address',
    env.SETI_TREASURY_ADDRESS.toLowerCase() !== (merchant.payoutAddress ?? '').toLowerCase()
  );

  await teardown();

  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  console.log(
    '\nnote  the success path (both legs in one real receipt) is not covered here —\n' +
      'no batched transaction has been signed on Tempo yet. Prove it on Moderato\n' +
      'before switching FEE_ROUTING_MODE to batch.'
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('fee-batch check crashed:', error);
  // Tear down even on a crash: this suite creates two merchants, so a failure
  // that skipped cleanup left both behind.
  await teardownSafely();
  await prisma.$disconnect();
  process.exit(1);
});