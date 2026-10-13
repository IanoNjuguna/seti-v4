/**
 * Send reconciliation checks: `recordSend` must verify the chain before it
 * writes anything, and it must refuse when the fee was not actually collected.
 *
 * Run with:  FEE_ROUTING_MODE=batch npm run check:send
 *
 * Requires live Postgres and an RPC, because every assertion here is about what
 * the chain recorded. The happy path is anchored on a REAL batched transaction
 * (`ANCHOR` below, produced by `npm run prove:batch`), so this suite exercises
 * `recordSend` against the same two-leg receipt a customer's wallet produces —
 * not against a stub.
 *
 * The guard that matters most is the fee leg. A send that reaches the recipient
 * but not the treasury is the uncollected-fee failure wearing a new shape, and
 * it is the one a "did the money arrive?" test would happily pass.
 */
import { prisma } from '../lib/prisma.js';
import { decodeEventLog, erc20Abi, getAddress, parseAbiItem, type Hex } from 'viem';
import { recordSend, receivedSide } from './transactions.js';
import { getFxQuote } from './payments.js';
import { issueQuote } from './quote.js';
import { calculateMerchantFee } from './fees.js';
import { formatUnits, getTokenContract, publicClient, estimateNetworkFee } from './chain.js';
import { env } from '../config/env.js';

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/**
 * A real batched transaction on Moderato: ONE transaction, two transfers —
 * 0.5 pathUSD to a throwaway recipient, and the 2% fee (0.01 pathUSD) to
 * SETI_TREASURY_ADDRESS. Signed and paid for by `npm run prove:batch`.
 *
 * Anchoring on it is what makes the happy path a statement about Tempo rather
 * than about this file: the receipt it points at was produced by a wallet, in
 * the shape the client signs, and it is immutable.
 */
const ANCHOR = {
  txHash: '0x913060ec28c168c38494bd5b725dea2778f93d34275c766447be2c45c68a9dcf' as Hex,
  recipient: '0x617C416110B328dB48030259c8664F29403Ce074',
  principal: '0.5',
  asset: 'pathusd',
} as const;

/** A valid address no user holds, for the self-send refusal. */
const SELF_ADDRESS = getAddress('0x0000000000000000000000000000000000000001');
const CHECK_EMAIL = 'send-check@seti.test';
/**
 * The OTHER side of the same transfer: a fixture whose wallet address IS the
 * anchor's recipient, so `recordSend` has a Seti account to write the incoming row
 * for. Without it the receive branch is untestable against a real receipt.
 */
const RECIPIENT_EMAIL = 'send-check-recipient@seti.test';

/**
 * Where Tempo pays the transaction fee, in a stablecoin, via the Fee AMM.
 *
 * It shows up as a Transfer in every Tempo receipt (see `prove:batch`), and it is
 * skipped when looking for a plain transfer to anchor the fee-leg guard on:
 * using the fee recipient as the "recipient" would test the guard against a
 * transfer that is itself a fee.
 */
const FEE_RECIPIENT = '0xfeec000000000000000000000000000000000000';

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

/**
 * Finds a recent pathUSD transfer that is NOT part of the anchor.
 *
 * Used for the realistic "recipient got paid, treasury did not" case: a plain
 * transfer has a principal leg and no fee leg, which is exactly the shape the
 * guard has to catch. Walking in 10-block chunks because the provider caps the
 * range a single `getLogs` may cover.
 */
async function findRecentPathUsdTransfer(): Promise<string | null> {
  const head = await publicClient.getBlockNumber();
  const CHUNK = 10n;

  for (let end = head; end > head - 20_000n; end -= CHUNK) {
    try {
      const logs = await publicClient.getLogs({
        address: getTokenContract('pathusd'),
        event: transferEvent,
        fromBlock: end - CHUNK + 1n > 0n ? end - CHUNK + 1n : 0n,
        toBlock: end,
      });
      const plain = logs.find(
        (log) => String(log.args.to).toLowerCase() !== FEE_RECIPIENT
      );
      if (plain) return plain.transactionHash;
    } catch {
      // provider refused this chunk; try the next
    }
  }

  return null;
}

async function describeTransfer(
  txHash: Hex
): Promise<{ to: string; value: string } | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const token = getTokenContract('pathusd').toLowerCase();

  for (const entry of receipt.logs) {
    if (entry.address.toLowerCase() !== token) continue;
    try {
      const decoded = decodeEventLog({ abi: erc20Abi, data: entry.data, topics: entry.topics });
      if (decoded.eventName === 'Transfer') {
        return {
          to: String(decoded.args.to),
          value: formatUnits(decoded.args.value, 6),
        };
      }
    } catch {
      // not a Transfer we can read; keep looking
    }
  }

  return null;
}

/**
 * Removes this suite's fixtures by their fixed identity, so it is idempotent and
 * safe from a crash handler — a `txHash` is unique in `transactions`, so a
 * leftover row would fail the next run with a constraint error rather than a
 * useful message.
 */
async function teardown(): Promise<void> {
  for (const email of [CHECK_EMAIL, RECIPIENT_EMAIL]) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.wallet.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

async function teardownSafely(): Promise<void> {
  try {
    await teardown();
  } catch (error) {
    console.error('fixture teardown failed:', error instanceof Error ? error.message : error);
  }
}

async function main(): Promise<void> {
  if (env.FEE_ROUTING_MODE !== 'batch') {
    console.log(
      'skip  FEE_ROUTING_MODE is not "batch" — `recordSend` refuses every send there,\n' +
        '      which is the point of it, but it makes the rest of this suite unreachable.\n' +
        'Run it as: FEE_ROUTING_MODE=batch npm run check:send'
    );
    await prisma.$disconnect();
    process.exit(0);
  }

  const quote = await getFxQuote();
  console.log(`fee routing mode: ${env.FEE_ROUTING_MODE}`);
  console.log(`treasury: ${env.SETI_TREASURY_ADDRESS}`);
  console.log(`rate: ${quote.fiatPerUsd} (${quote.source})\n`);

  await teardown();

  const user = await prisma.user.create({ data: { email: CHECK_EMAIL } });

  /**
   * The rate is FROZEN at quote time. Every `recordSend` below must present a
   * signed quote; issuing it from the SAME live rate this suite quotes keeps the
   * persisted figures equal to the rate the assertions recompute from, so the
   * existing expectations are unchanged rather than weakened.
   */
  const sendQuoteId = issueQuote({
    userId: user.id,
    fiatCurrency: quote.fiatCurrency,
    fiatPerUsd: quote.fiatPerUsd,
    source: quote.source,
    asOf: quote.asOf,
  });

  // The wallet's address is a real, valid address (the self-send refusal runs
  // through EIP-55 validation first, so a placeholder string would be refused
  // for the wrong reason). Nothing signs with it.
  //
  // The label is deliberately NOT the asset the suite sends (`pathusd`): login
  // registers every wallet as `ousd`, and a lookup that filtered on the asset
  // therefore refused every real send — after the money had left the wallet —
  // while this fixture, labelled to match the transfer, passed. Keeping the
  // mismatch here is what pins the fix; do not "tidy" it into agreement.
  await prisma.wallet.create({
    data: {
      userId: user.id,
      chain: 'tempo',
      asset: 'ousd',
      address: SELF_ADDRESS,
    },
  });

  // The recipient side of the anchor: a registered wallet at the address the
  // on-chain transfer actually paid.
  const recipientUser = await prisma.user.create({ data: { email: RECIPIENT_EMAIL } });
  await prisma.wallet.create({
    data: {
      userId: recipientUser.id,
      chain: 'tempo',
      asset: 'pathusd',
      address: getAddress(ANCHOR.recipient),
    },
  });

  const countRows = () => prisma.transaction.count({ where: { userId: user.id } });

  // --- The anchor must still be what this suite thinks it is -----------------
  const anchorReceipt = await publicClient
    .getTransactionReceipt({ hash: ANCHOR.txHash })
    .catch(() => null);

  const anchorUsable =
    anchorReceipt?.status === 'success' &&
    env.SETI_TREASURY_ADDRESS.toLowerCase() !== '' &&
    anchorReceipt.logs.some(
      (entry) => entry.address.toLowerCase() === getTokenContract('pathusd').toLowerCase()
    );

  // --- Guards that do not need a real receipt -------------------------------

  let threw = false;
  let message = '';
  try {
    await recordSend({
      userId: user.id,
      amount: '1',
      asset: 'pathusd',
      recipient: '0xnot-an-address',
      txHash: `0x${'11'.repeat(32)}`,
      quoteId: sendQuoteId,
    });
  } catch (error) {
    threw = true;
    message = error instanceof Error ? error.message : String(error);
  }
  check('a malformed recipient is refused', threw, message.slice(0, 70));
  check(
    'and the refusal names the address problem, not a receipt',
    /20-byte|checksum/i.test(message),
    message.slice(0, 70)
  );
  check('no row written for a malformed recipient', (await countRows()) === 0);

  threw = false;
  message = '';
  try {
    await recordSend({
      userId: user.id,
      amount: '1',
      asset: 'pathusd',
      recipient: SELF_ADDRESS,
      txHash: `0x${'22'.repeat(32)}`,
      quoteId: sendQuoteId,
    });
  } catch (error) {
    threw = true;
    message = error instanceof Error ? error.message : String(error);
  }
  check('a send to the sender\'s own wallet is refused', threw, message.slice(0, 70));
  check('and says the transfer would move nothing', /move nothing/i.test(message));
  check('no row written for a self-send', (await countRows()) === 0);

  // --- "Recipient paid, treasury not" — the missing fee leg ----------------
  console.log('\nrecipient leg present, fee leg missing:');

  const plainTx = await findRecentPathUsdTransfer();
  const plainTransfer = plainTx ? await describeTransfer(plainTx as Hex) : null;

  if (!plainTx || !plainTransfer) {
    console.log('skip  no recent pathUSD transfer found; cannot exercise the fee-leg guard.');
  } else {
    console.log(`  anchoring on plain transfer: ${plainTx}`);
    console.log(`  recipient ${plainTransfer.to}, moved ${plainTransfer.value}\n`);

    threw = false;
    message = '';
    try {
      await recordSend({
        userId: user.id,
        amount: plainTransfer.value,
        asset: 'pathusd',
        recipient: plainTransfer.to,
        txHash: plainTx,
        quoteId: sendQuoteId,
      });
    } catch (error) {
      threw = true;
      message = error instanceof Error ? error.message : String(error);
    }

    check('a send with no treasury leg is refused', threw, message.slice(0, 70));
    check(
      'and the message names the fee leg, not a receipt failure',
      /fee leg/i.test(message),
      message.slice(0, 70)
    );
    check(
      'the recipient leg itself resolved (the guard is not passing on a missing receipt)',
      !/receipt not available|reverted/i.test(message) &&
        message.toLowerCase().includes(env.SETI_TREASURY_ADDRESS.slice(0, 10).toLowerCase()),
      message.slice(0, 78)
    );
    check('no row written when the fee leg is missing', (await countRows()) === 0);

    // The same receipt with a materially different claim must be refused for the
    // amount, before the fee leg is even considered.
    threw = false;
    message = '';
    const wrongAmount = (Number(plainTransfer.value) * 3).toFixed(8);
    try {
      await recordSend({
        userId: user.id,
        amount: wrongAmount,
        asset: 'pathusd',
        recipient: plainTransfer.to,
        txHash: plainTx,
        quoteId: sendQuoteId,
      });
    } catch (error) {
      threw = true;
      message = error instanceof Error ? error.message : String(error);
    }
    check('an overstated amount is refused', threw, message.slice(0, 70));
    check('and the refusal is the amount, not the fee leg', /mismatch/i.test(message));
    check('no row written for an overstated amount', (await countRows()) === 0);
  }

  // --- The happy path, against a real batched receipt ----------------------
  console.log('\nthe happy path (a real batched transaction):');

  if (!anchorUsable) {
    console.log(
      'skip  the anchor receipt is not readable on this chain. Run\n' +
        '      `npm run prove:batch` to produce one, then update ANCHOR in this file.'
    );
  } else {
    const transaction = await recordSend({
      userId: user.id,
      amount: ANCHOR.principal,
      asset: ANCHOR.asset,
      recipient: ANCHOR.recipient,
      txHash: ANCHOR.txHash,
      quoteId: sendQuoteId,
    });

    check('a two-leg send is recorded, not refused', Boolean(transaction.id));
    check('it is written as a p2p_send', transaction.type === 'p2p_send');
    check(
      'and it carries the hash that was verified',
      transaction.txHash === ANCHOR.txHash
    );
    check(
      'the counterparty is the recipient the chain paid',
      transaction.counterparty?.toLowerCase() === ANCHOR.recipient.toLowerCase()
    );

    // The fee is the whole point: it must be recorded, and it must be the 2% of
    // the principal the chain actually moved.
    const expectedPrincipalKes = Number(ANCHOR.principal) * quote.fiatPerUsd;
    const recordedFee = Number(transaction.feeAmount);
    const recordedFiat = Number(transaction.fiatAmount);
    const schedule = calculateMerchantFee(Math.round(expectedPrincipalKes * 100) / 100);

    check(
      'the fee is recorded, and is the 2% of the principal',
      Math.abs(recordedFee - schedule.feeFiat) < 0.02,
      `recorded ${recordedFee} vs schedule ${schedule.feeFiat}`
    );
    check(
      'the principal is recorded in KES',
      Math.abs(recordedFiat - expectedPrincipalKes) < 0.02,
      `recorded ${recordedFiat} vs ${expectedPrincipalKes.toFixed(2)}`
    );
    check(
      'the fee reached the treasury, per the receipt',
      Number(
        (transaction.metadata as { treasuryFeeObserved?: string } | null)?.treasuryFeeObserved
      ) > 0
    );
    check('exactly one row was written', (await countRows()) === 1);
    check(
      'an audit entry names the recipient',
      (await prisma.auditLog.count({
        where: { userId: user.id, action: 'send.recorded' },
      })) === 1
    );

    // --- The recipient's side ----------------------------------------------
    //
    // One on-chain transfer, two movements of money. Before `receivedSide` existed
    // the recipient of a Seti-to-Seti transfer had NO row at all, so their Activity
    // was empty while the sender's balance changed. Their row must carry the
    // PRINCIPAL — the fee went to the treasury and is already on the sender's row.
    const receivedRows = await prisma.transaction.findMany({
      where: { userId: recipientUser.id },
    });
    check('the recipient has one row for the transfer', receivedRows.length === 1);
    check('and it reads as money coming in', receivedRows[0]?.type === 'p2p_receive');
    check(
      'carrying the principal, not the gross',
      receivedRows[0]?.amount?.toNumber() === Number(ANCHOR.principal)
    );
    check('and already settled, since it was read off a confirmed receipt', receivedRows[0]?.status === 'completed');
    check(
      'and it names the sender',
      receivedRows[0]?.counterparty?.toLowerCase() === SELF_ADDRESS.toLowerCase()
    );

    // Idempotent: a transfer cannot be recorded twice for one account, so a retry
    // (or the indexer walking the same block again) must not duplicate it.
    await receivedSide({
      recipient: getAddress(ANCHOR.recipient),
      amountAsset: Number(ANCHOR.principal),
      amountFiat: Number(ANCHOR.principal) * quote.fiatPerUsd,
      asset: ANCHOR.asset,
      txHash: ANCHOR.txHash,
      senderAddress: SELF_ADDRESS,
      quote,
    });
    check(
      're-recording the same transfer does not duplicate the row',
      (await prisma.transaction.count({ where: { userId: recipientUser.id } })) === 1
    );
  }

  // --- Gas: the displayed figure must be a real cost, not a fudge ----------
  //
  // Two claims are load-bearing in `estimateNetworkFee`: that gas accounting is
  // 18-decimal wei while the token charges in 6-decimal units (a factor of 1e12),
  // and that the measured gas of a real batch is the gas it quotes. Both are
  // checkable against the anchor receipt, whose gas payment is a Transfer like
  // any other — to the Fee AMM's recipient rather than to a person.
  console.log('\ngas calibration:');

  if (!anchorReceipt) {
    console.log('skip  no anchor receipt to calibrate against.');
  } else {
    const scale = BigInt(10 ** 12);
    const gasPriceUsed = anchorReceipt.effectiveGasPrice ?? (await publicClient.getGasPrice());
    const computedUnits = (anchorReceipt.gasUsed * gasPriceUsed) / scale;

    const token = getTokenContract(ANCHOR.asset).toLowerCase();
    const feePayment = anchorReceipt.logs
      .filter((entry) => entry.address.toLowerCase() === token)
      .flatMap((entry) => {
        try {
          const decoded = decodeEventLog({ abi: erc20Abi, data: entry.data, topics: entry.topics });
          if (decoded.eventName !== 'Transfer') return [];
          return String(decoded.args.to).toLowerCase() === FEE_RECIPIENT ? [decoded.args.value] : [];
        } catch {
          return [];
        }
      })[0];

    if (feePayment === undefined) {
      console.log('skip  the anchor batch paid no fee transfer to read.');
    } else {
      const delta =
        computedUnits > feePayment ? computedUnits - feePayment : feePayment - computedUnits;

      check(
        'gas is 18-decimal wei against a 6-decimal token (1e12), within rounding',
        delta <= BigInt(2),
        `computed ${computedUnits} vs chain charged ${feePayment}`
      );

      const live = await estimateNetworkFee('pathusd');
      const liveUnits = BigInt(Math.round(Number(live.feeAsset) * 1_000_000));
      check(
        'the live estimate is the same order of magnitude as a real batch fee',
        liveUnits > BigInt(0) && liveUnits <= feePayment * BigInt(10) && liveUnits * BigInt(10) >= feePayment,
        `estimate ${live.feeAsset} (${live.source}) vs real ${formatUnits(feePayment, 6)}`
      );
    }
  }

  await teardown();
  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('send check crashed:', error);
  await teardownSafely();
  await prisma.$disconnect();
  process.exit(1);
});
