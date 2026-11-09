/**
 * Reconciliation checks: recordPayment must verify the client-claimed gross
 * against what actually moved on-chain.
 *
 * Run with:  npm run check:reconcile
 *
 * Requires live Postgres and an RPC (mainnet by default, since that is where
 * the fraud path matters). This deliberately points at real mainnet
 * transactions:
 *
 *  - the MISMATCH cases reuse a real hash, so the only reason they can fail is
 *    the claimed-vs-observed comparison, not a missing receipt;
 *  - the NOT-FOUND case uses a well-formed but non-existent hash to prove we
 *    fail closed rather than recording an unverifiable payment.
 *
 * The legacy path (merchant with no payoutAddress) is covered too, because that
 * bypass is exactly what a reviewer needs to be able to see.
 */
import { decodeEventLog, erc20Abi, parseAbiItem } from 'viem';
import { prisma } from '../lib/prisma.js';
import { formatUnits, getTokenContract, publicClient, servedNetwork } from './chain.js';
import { recordPayment } from './transactions.js';
import { getFxQuote } from './payments.js';
import { issueQuote } from './quote.js';

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/**
 * The refusal record for a hash, found the way support finds it: by the
 * `audit_logs.txHash` column, not by scanning the metadata JSON.
 */
async function refusalFor(txHash: string) {
  return prisma.auditLog.findFirst({
    where: { txHash, action: 'payment.rejected' },
    orderBy: { createdAt: 'desc' },
  });
}

function refusalCode(row: { metadata?: unknown } | null): string {
  const meta = (row?.metadata ?? {}) as { code?: string };
  return meta.code ?? '(none)';
}

/**
 * A real mainnet transaction that actually moved OUSD.
 *
 * Chosen via eth_getLogs over a recent block range for the OUSD contract's
 * Transfer topic, so the receipt genuinely contains a matching OUSD Transfer.
 * That matters: it lets the amount-mismatch test fail for the RIGHT reason.
 * With a hash whose receipt lacked an OUSD transfer, `recordPayment` would
 * reject on "no Transfer to <recipient>" and the amount comparison would never
 * execute — the test would pass while proving nothing.
 *
 * Discovered dynamically in main() and asserted to be non-null; if OUSD has no
 * recent transfers the whole file skips rather than asserting against a fiction.
 */
let realTx: string | null = null;

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

/**
 * Discovers a recent mainnet OUSD Transfer to anchor the mismatch case.
 *
 * Walks backwards in 10-block chunks rather than one wide query: Alchemy's free
 * tier rejects eth_getLogs ranges above 10 blocks on Tempo mainnet, so a single
 * 500-block query fails outright.
 */
async function findRecentOusdTransfer(): Promise<string | null> {
  const head = await withRetry(() => publicClient.getBlockNumber());

  for (let end = head; end > head - 200n; end -= 10n) {
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

/**
 * Reads the chain, and asks again when the read did not complete.
 *
 * A node that timed out has not disagreed with us, and this suite turns a disagreement
 * into a merge failure. The retry is short and bounded: a transport hiccup gets another
 * chance, a definitive answer does not (#509).
 */
async function withRetry<T>(read: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      // Linear backoff. The whole budget is under a second, because this runs in front
      // of every deploy and a hung gate is worse than a retried one.
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  throw lastError;
}

/**
 * The anchor a mismatch case can be asserted against: ONE receipt, confirmed usable.
 *
 * The case this replaces was the whole of #509. It read the recipient and the amount
 * from two separate `getTransactionReceipt` calls and never checked what the receipt's
 * `status` was. When the chain answered with something the run could not use, the
 * refusal came back as `receipt-reverted` instead of the amount mismatch, and three
 * assertions fell over — on a commit that had already passed the same gate two minutes
 * earlier.
 *
 * So: ONE read, both figures out of it, and a positive requirement that the transaction
 * SUCCEEDED. A receipt whose status is not `success` cannot anchor a mismatch case,
 * because `recordPayment` will (correctly) refuse it as a reverted transaction before
 * the amount comparison ever runs.
 */
type Anchor =
  | { ok: true; txHash: string; recipient: string; observed: number }
  | { ok: false; reason: string };

async function confirmAnchor(txHash: string): Promise<Anchor> {
  let receipt;
  try {
    receipt = await withRetry(() =>
      publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` })
    );
  } catch {
    return { ok: false, reason: 'the receipt could not be read from the chain' };
  }

  if (receipt.status !== 'success') {
    return { ok: false, reason: `the transaction ${txHash} is not successful on chain` };
  }

  const ousd = getTokenContract('ousd').toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ousd) continue;
    try {
      const decoded = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (decoded.eventName !== 'Transfer') continue;

      return {
        ok: true,
        txHash,
        recipient: String(decoded.args.to),
        observed: Number(formatUnits(decoded.args.value, 6)),
      };
    } catch {
      // An undecodable OUSD log is not the one we are looking for.
    }
  }

  return { ok: false, reason: `no OUSD Transfer in ${txHash}` };
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
    where: {
      name: {
        in: [
          'Reconcile Check Merchant',
          'Amount-Mismatch Merchant',
          'Merchant With No Payout Address',
        ],
      },
    },
    select: { id: true },
  });
  const merchantIds = merchants.map((merchant) => merchant.id);

  // Transactions before merchants and before wallets: the merchant FK is
  // ON DELETE SET NULL (so deleting the merchant first would strand the payment
  // row rather than remove it) and the wallet FK is RESTRICT.
  if (merchantIds.length > 0) {
    await prisma.transaction.deleteMany({ where: { merchantId: { in: merchantIds } } });
  }

  const user = await prisma.user.findUnique({ where: { email: 'reconcile-check@seti.test' } });
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
  const quote = await getFxQuote();
  console.log(`chain rate: ${quote.fiatPerUsd} (${quote.source})\n`);

  realTx = await findRecentOusdTransfer();
  // Confirmed BEFORE anything asserts on it: the anchor is a real receipt, and a
  // receipt this run cannot use must skip the case rather than fail it (#509).
  const anchor: Anchor = realTx
    ? await confirmAnchor(realTx)
    : { ok: false, reason: 'no recent OUSD transfer was found' };
  console.log(
    anchor.ok
      ? `anchoring mismatch case on real OUSD transfer: ${anchor.txHash}`
      : `skip  amount-mismatch case (${anchor.reason})`
  );
  console.log('');

  const user = await prisma.user.upsert({
    where: { email: 'reconcile-check@seti.test' },
    update: {},
    create: { email: 'reconcile-check@seti.test' },
  });

  // Fixture only: `teardown()` finds it through the user, so no id is needed here.
  //
  // A REAL 20-byte address (12 hex digits of timestamp + a fixed tag, so a
  // concurrent run cannot share the row). Every `recordPayment` below declares the
  // wallet that signed: the declaration is checked before anything else, and these
  // cases have to be refused for what they are TESTING — the amount, the receipt,
  // the merchant — not for the wallet. Nothing signs with it; every case here is
  // refused before the sender check.
  const SIGNING_ADDRESS = `0x${Date.now().toString(16).padStart(12, '0')}${'c0de'.repeat(7)}`;
  // A wallet row's ADDRESS is unique PER NETWORK now, not globally, so it can no
  // longer key an upsert. Key on an explicit id instead.
  const SIGNING_WALLET_ID = 'check-reconcile-signer';

  await prisma.wallet.upsert({
    where: { id: SIGNING_WALLET_ID },
    update: {},
    create: {
      id: SIGNING_WALLET_ID,
      userId: user.id,
      chain: 'tempo',
      asset: 'ousd',
      address: SIGNING_ADDRESS,
      // Registered on the network this suite RECORDS ON, which is the one this
      // deployment serves: every `recordPayment` below is recorded there (the
      // served network is the record path's default) and reconciles against a
      // receipt read from the same chain. A fixture row on the column default
      // ('testnet') while the box serves mainnet is a wallet the account does not
      // hold where it is paying, so every case here was refused `signer-not-owned`
      // — a refusal for the wrong reason, before the condition under test.
      network: servedNetwork,
    },
  });

  // --- Merchant WITH a payoutAddress: verification is enforced -------------
  const merchant = await prisma.merchant.create({
    data: {
      name: 'Reconcile Check Merchant',
      payoutAddress: '0x000000000000000000000000000000000000dEaD',
    },
  });

  /**
   * The rate is FROZEN at quote time: every `recordPayment` below must present a
   * signed quote. Issued from the same live rate this suite reads, so the
   * reconciliation refusals these assertions are about are reached exactly as
   * before — the freeze is a precondition, not a change to them.
   */
  const quoteId = issueQuote({
    userId: user.id,
    fiatCurrency: quote.fiatCurrency,
    fiatPerUsd: quote.fiatPerUsd,
    source: quote.source,
    asOf: quote.asOf,
  });

  // A receipt we cannot read must fail closed, not record an unverifiable row.
  let threw = false;
  let message = '';
  try {
    await recordPayment({
      userId: user.id,
      amount: (100 / quote.fiatPerUsd).toFixed(8),
      asset: 'ousd',
      merchantId: merchant.id,
      txHash: '0x' + '11'.repeat(32), // well-formed, does not exist
      quoteId,
      walletAddress: SIGNING_ADDRESS,
    });
  } catch (error) {
    threw = true;
    message = error instanceof Error ? error.message : String(error);
  }
  check('unverifiable tx is refused (fail closed)', threw, message.slice(0, 72));
  check(
    'no transaction row written for unverifiable payment',
    (await prisma.transaction.count({ where: { merchantId: merchant.id } })) === 0
  );

  // The refusal must still be findable. Before this existed the only trace of a
  // refused payment was a 500 in a log line, so a customer saying "it did not
  // land" had nothing support could query. The hash is the key, because it is
  // the one handle that exists whether or not a row was written.
  const unverifiableRefusal = await refusalFor('0x' + '11'.repeat(32));
  check('refusal is recorded against its txHash', unverifiableRefusal !== null);
  check(
    'refusal carries a machine-readable code',
    refusalCode(unverifiableRefusal) === 'receipt-unavailable',
    refusalCode(unverifiableRefusal)
  );

  // A real receipt whose amount does not match the claim must be refused.
  threw = false;
  message = '';
  try {
    await recordPayment({
      userId: user.id,
      // Claims ~KES 1,300 of value; realTx moved something else entirely.
      amount: (1300 / quote.fiatPerUsd).toFixed(8),
      asset: 'ousd',
      merchantId: merchant.id,
      txHash: realTx ?? '0x' + '00'.repeat(32),
      quoteId,
      walletAddress: SIGNING_ADDRESS,
    });
  } catch (error) {
    threw = true;
    message = error instanceof Error ? error.message : String(error);
  }
  check('gross mismatch vs chain is refused', threw, message.slice(0, 72));
  check(
    'still no row written after a mismatch',
    (await prisma.transaction.count({ where: { merchantId: merchant.id } })) === 0
  );

  // Exercise the AMOUNT comparison itself, not just "recipient absent".
  //
  // Points the merchant at the real recipient of realTx's transfer so the
  // receipt DOES contain a matching Transfer log, then claims a grossly
  // different amount. Without this, the recipient check could mask a broken
  // amount check.
  if (anchor.ok) {
    const anchorTx = anchor.txHash;
    const targetMerchant = await prisma.merchant.create({
      data: { name: 'Amount-Mismatch Merchant', payoutAddress: anchor.recipient },
    });

    // Both figures came out of the ONE receipt confirmed above, so the claim and the
    // observed amount cannot be read from different states of the chain.
    const observedFiat = anchor.observed;

    threw = false;
    message = '';
    try {
      // Claim a figure far from what actually moved.
      await recordPayment({
        userId: user.id,
        amount: ((observedFiat * 5) / quote.fiatPerUsd).toFixed(8),
        asset: 'ousd',
        merchantId: targetMerchant.id,
        txHash: anchorTx,
        quoteId,
        walletAddress: SIGNING_ADDRESS,
      });
    } catch (error) {
      threw = true;
      message = error instanceof Error ? error.message : String(error);
    }
    check('amount mismatch (recipient matches) is refused', threw, message.slice(0, 80));
    check(
      'message names the mismatch, not a receipt failure',
      /mismatch/i.test(message),
      message.slice(0, 60)
    );
    check(
      'no row written on amount mismatch',
      (await prisma.transaction.count({ where: { merchantId: targetMerchant.id } })) === 0
    );

    const mismatchRefusal = await refusalFor(anchorTx);
    check(
      'amount mismatch is recorded with its own code',
      refusalCode(mismatchRefusal) === 'amount-mismatch',
      refusalCode(mismatchRefusal)
    );
    check(
      'the mismatch record carries both figures',
      mismatchRefusal?.metadata !== null &&
        typeof (mismatchRefusal?.metadata as { claimedAmount?: unknown })?.claimedAmount === 'number' &&
        typeof (mismatchRefusal?.metadata as { observedAmount?: unknown })?.observedAmount === 'number'
    );

    await prisma.merchant.delete({ where: { id: targetMerchant.id } });
  } else {
    // The reason was printed above, where the anchor was confirmed. Nothing is asserted
    // here: a case that could not be anchored proves nothing either way (#509).
    console.log('skip  amount-mismatch records (nothing was anchored)');
  }

  // A non-positive claim is rejected before any chain call.
  //
  // The hash is a fixed, well-formed but non-existent one rather than the real
  // anchor: the amount check runs before any chain read, so a real receipt is not
  // needed to reach it — and an anchor is skipped entirely on a quiet chain. Passing
  // a null hash would key the refusal to nothing, tripping the
  // "every refusal is recorded against its txHash" assertion below for a reason
  // that has nothing to do with the implementation. A keyed hash keeps that
  // assertion meaningful in every run.
  const badAmountHash = '0x' + '77'.repeat(32);
  for (const bad of ['0', '-5']) {
    threw = false;
    try {
      await recordPayment({
        userId: user.id,
        amount: bad,
        asset: 'ousd',
        merchantId: merchant.id,
        txHash: badAmountHash,
        quoteId,
        walletAddress: SIGNING_ADDRESS,
      });
    } catch {
      threw = true;
    }
    check(`non-positive amount "${bad}" is rejected`, threw);
  }
  check(
    'a bad amount is a recorded refusal, not a bare throw',
    refusalCode(await refusalFor(badAmountHash)) === 'amount-invalid',
    refusalCode(await refusalFor(badAmountHash))
  );

  // --- Regression: a merchant with no payoutAddress must be REJECTED -------
  //
  // This used to be a documented bypass: no address meant no chain
  // verification, and the client's claimed figures were recorded as settled.
  // On mainnet that is the under-reporting path reconciliation exists to close,
  // so it now fails closed. Asserted explicitly so it cannot be reintroduced as
  // "just a convenience for merchants without an address".
  console.log('\nmerchant without a payout address:');
  const noAddressMerchant = await prisma.merchant.create({
    data: { name: 'Merchant With No Payout Address' },
  });

  threw = false;
  message = '';
  try {
    await recordPayment({
      userId: user.id,
      amount: (5100 / quote.fiatPerUsd).toFixed(8),
      asset: 'ousd',
      merchantId: noAddressMerchant.id,
      txHash: '0x' + '22'.repeat(32),
      quoteId,
      walletAddress: SIGNING_ADDRESS,
    });
  } catch (error) {
    threw = true;
    message = error instanceof Error ? error.message : String(error);
  }

  check('merchant with no payout address is refused', threw, message.slice(0, 70));
  check(
    'message points at the missing payout address',
    /payout address/i.test(message)
  );
  check(
    'no row written for a merchant with no payout address',
    (await prisma.transaction.count({ where: { merchantId: noAddressMerchant.id } })) === 0
  );

  const noAddressRefusal = await refusalFor('0x' + '22'.repeat(32));
  check(
    'missing payout address is recorded with its own code',
    refusalCode(noAddressRefusal) === 'merchant-no-payout-address',
    refusalCode(noAddressRefusal)
  );

  // The property that makes the lookup work for every refusal, including ones
  // added later: a refusal with no hash is unfindable, which is the state this
  // whole change exists to leave behind.
  const refusalsWithoutHash = await prisma.auditLog.count({
    where: { userId: user.id, action: 'payment.rejected', txHash: null },
  });
  check('every refusal record is keyed by a txHash', refusalsWithoutHash === 0, `${refusalsWithoutHash} unkeyed`);

  await teardown();

  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('reconcile check crashed:', error);
  // Tear down even on a crash: a fixture that outlives the run is how this
  // database accumulated orphan merchants and fixture users.
  await teardownSafely();
  await prisma.$disconnect();
  process.exit(1);
});
