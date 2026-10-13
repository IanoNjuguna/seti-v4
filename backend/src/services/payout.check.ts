/**
 * Payout-path checks: that recordPayment persists the fee and FX provenance.
 *
 * Run with:  npm run check:payout
 * Requires:  docker compose up -d (in backend/)
 *
 * recordPayment reconciles the claimed gross against the chain and fails closed,
 * so a successful insert requires a REAL OUSD transfer to a merchant whose
 * payoutAddress is that transfer's actual recipient. This suite therefore
 * anchors on a real on-chain transaction discovered at run time, and claims the
 * amount that moved — so what it asserts is the persisted fee arithmetic rather
 * than the reconciliation (which reconcile.check.ts covers).
 *
 * A synthetic txHash cannot exercise the success path any more: reconciliation
 * rejects it, which is correct. That is why this file reaches the chain instead
 * of stubbing it.
 *
 * DUST: at 2dp, 2% of a payment only becomes exactly representable above
 * roughly KES 2. Real chains carry many dust transfers, so the suite prefers a
 * substantial anchor, falls back to the largest transfer it can find, and SKIPS
 * the percentage assertions when the anchor is too small for them to mean
 * anything. It asserts loudly rather than guessing.
 */
import { decodeEventLog, erc20Abi, parseAbiItem } from 'viem';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { FEE_AMM_ADDRESS, formatUnits, getTokenContract, publicClient } from './chain.js';
import { recordPayment } from './transactions.js';
import { getFxQuote } from './payments.js';
import { issueQuote } from './quote.js';

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

/**
 * Ceiling on candidate transfers probed for a treasury leg.
 *
 * Each probe is a `getTransactionReceipt` round-trip, so an unbounded search over
 * a busy range turns this suite into a hang. In practice it is also pointless:
 * until a real batched payment has landed, NO receipt on the chain contains a
 * treasury leg, so the search is guaranteed to exhaust and should report that
 * plainly rather than keep spending RPC calls.
 */
const MAX_FEE_LEG_PROBES = 25;

/** Rough KES/USD, used only to size the anchor search — never for assertions. */
const APPROX_KES_PER_USD = 130;

/**
 * Minimum anchor size, in KES, for the fee arithmetic to be testable.
 * Below this, 2dp rounding dominates and a percentage assertion is noise.
 */
const MIN_ANCHOR_KES = 20;

/**
 * Whether recordPayment demands a treasury leg as well as the merchant leg.
 *
 * The success path differs by mode: `inside-transfer` reconciles one gross
 * transfer, `batch` reconciles a principal leg PLUS a fee leg. Anchoring and
 * claiming accordingly is what keeps this suite meaningful in both.
 */
const batchMode = env.FEE_ROUTING_MODE === 'batch';

/** Principal at or above which feeUncappedAmount and feeAmount must agree. */
const MEANINGFUL_PRINCIPAL_KES = 2;

interface Anchor {
  txHash: string;
  /** Real recipient of the on-chain transfer. */
  recipient: string;
  /** Amount that actually moved, in token units. */
  observed: number;
  /**
   * Fee leg to the treasury found in the same receipt, in token units.
   *
   * Only populated in `batch` mode, where the anchor must contain BOTH legs for
   * the success path to be reachable at all. `recordPayment` refuses a receipt
   * with no treasury transfer, so anchoring on a single-leg receipt would make
   * this suite fail before any fee arithmetic ran.
   */
  feeObserved: number | null;
}

/**
 * The protocol's fee-recipient address: every Tempo transaction pays its gas to
 * it, as a TIP-20 transfer in the fee token. Not a payment leg, and must never be
 * mistaken for one when reading a receipt's transfers.
 */
const FEE_AMM = FEE_AMM_ADDRESS;

/**
 * Finds a real recent OUSD **batched** transfer: a receipt carrying a transfer to
 * SETI_TREASURY_ADDRESS, which only a batch produces.
 *
 * Queried by the FEE LEG rather than by scanning transfers in general, and that is
 * the whole trick. The testnet faucet mints 1,000,000 OUSD to random addresses
 * every few blocks, so any search that walks transfers in block order spends its
 * probe budget on mint noise before reaching a real batch — it reported "no
 * batched OUSD transfer found" while the batch it wanted sat in the same chunk.
 * The treasury, by contrast, is paid by batches and almost nothing else, so a
 * `to: treasury` query returns a handful of logs and every one of them is a
 * candidate fee leg.
 *
 * The principal leg is then the largest remaining OUSD transfer in that receipt
 * (excluding the treasury and the fee AMM), because a receipt may carry several
 * transfers and only one of them is the payment.
 */
async function findBatchedAnchor(fromBlock: bigint, head: bigint): Promise<Anchor | null> {
  const treasury = env.SETI_TREASURY_ADDRESS;
  let candidates;

  try {
    candidates = await publicClient.getLogs({
      address: getTokenContract('ousd'),
      event: transferEvent,
      args: { to: treasury as `0x${string}` },
      fromBlock,
      toBlock: head,
    });
  } catch {
    return null;
  }

  // Newest first: the freshest batch is the most likely to still be reconciled
  // the same way this suite expects.
  for (const feeLog of [...candidates].reverse()) {
    const receipt = await publicClient.getTransactionReceipt({ hash: feeLog.transactionHash });
    const ousd = getTokenContract('ousd').toLowerCase();
    const principal: Array<{ to: string; value: number }> = [];

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== ousd) continue;
      try {
        const decoded = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
        if (decoded.eventName !== 'Transfer') continue;
        const to = String(decoded.args.to);
        const lowered = to.toLowerCase();
        if (lowered === treasury.toLowerCase() || lowered === FEE_AMM) continue;
        principal.push({ to, value: Number(formatUnits(decoded.args.value, 6)) });
      } catch {
        // ignore undecodable logs
      }
    }

    if (principal.length === 0) continue;

    const biggest = principal.reduce((a, b) => (b.value > a.value ? b : a));
    const feeObserved = Number(formatUnits(feeLog.args.value as bigint, 6));

    if (biggest.value * APPROX_KES_PER_USD >= MIN_ANCHOR_KES) {
      return { txHash: feeLog.transactionHash, recipient: biggest.to, observed: biggest.value, feeObserved };
    }
  }

  return null;
}

/** Treasury transfer amount found in a receipt, or null if there isn't one. */
async function findTreasuryLeg(
  txHash: string,
  treasury: string
): Promise<number | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
  const ousd = getTokenContract('ousd').toLowerCase();
  const target = treasury.toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ousd) continue;
    try {
      const decoded = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (decoded.eventName !== 'Transfer') continue;
      if (String(decoded.args.to).toLowerCase() !== target) continue;
      return Number(formatUnits(decoded.args.value, 6));
    } catch {
      // ignore undecodable logs
    }
  }
  return null;
}

/**
 * Finds a real recent OUSD transfer to reconcile against.
 *
 * Searches wide. Recent OUSD activity on Tempo mainnet is sparse and often
 * capped at 0.01, so a small window can legitimately contain nothing testable —
 * the suite must not report "no transfer found" merely because activity is
 * quiet. Chunks are 2000 blocks (the public Tempo RPC serves that in about a
 * second); if a provider rejects the range, it degrades to 10-block chunks,
 * which is Alchemy's free-tier limit on mainnet.
 */
async function findAnchor(): Promise<Anchor | null> {
  const head = await publicClient.getBlockNumber();
  const window = 60_000n;

  // Batch mode asks for the FEE LEG first (see `findBatchedAnchor`) instead of
  // racing the faucet's mint spam for a 25-probe budget.
  if (batchMode) {
    const batched = await findBatchedAnchor(head > window ? head - window : 0n, head);
    if (batched) return batched;
  }

  let fallback: Anchor | null = null;
  let feeLegProbes = 0;

  for (let end = head; end > head - 60_000n; end -= 2_000n) {
    const logs = await tryGetLogs(end - 1_999n > 0n ? end - 1_999n : 0n, end);
    if (logs === null) continue;

    // NEWEST FIRST, and this is load-bearing. The testnet faucet mints 1,000,000
    // OUSD to random addresses continuously, so the oldest logs in any chunk are
    // almost all faucet mints — each one costs a `getTransactionReceipt` probe and
    // none of them carries a treasury leg. Scanned in block order the probe budget
    // (25) is spent entirely on mints before reaching the recent blocks, and the
    // suite reports "no batched OUSD transfer found" even when the batch it wants
    // is in the same chunk. A real batch is recent by construction, so reading
    // backwards finds it on the first few logs.
    const recentFirst = [...logs].reverse();

    for (const log of recentFirst) {
      const rawValue = log.args.value;
      const rawTo = log.args.to;
      if (typeof rawValue !== 'bigint' || typeof rawTo !== 'string') continue;

      const value = Number(formatUnits(rawValue, 6));
      const recipient = rawTo;

      // A transfer to the zero address is rejected by reconciliation for a
      // different reason, so it cannot serve as an anchor.
      if (/^0x0{40}$/i.test(recipient)) continue;
      if (value <= 0) continue;

      // In batch mode the anchor receipt must ALSO carry a transfer to the
      // treasury, or `recordPayment` refuses it and the success path this suite
      // exists to cover is unreachable. Look the fee leg up before accepting.
      //
      // Bounded: each probe is a receipt fetch, and before any batch exists
      // every probe fails, so an unbounded search would simply exhaust the whole
      // 60k-block range one round-trip at a time.
      let feeObserved: number | null = null;
      if (batchMode) {
        if (feeLegProbes >= MAX_FEE_LEG_PROBES) return fallback;
        feeLegProbes += 1;
        feeObserved = await findTreasuryLeg(log.transactionHash, env.SETI_TREASURY_ADDRESS);
        if (feeObserved === null) continue;
      }

      const candidate: Anchor = {
        txHash: log.transactionHash,
        recipient,
        observed: value,
        feeObserved,
      };

      if (value * APPROX_KES_PER_USD >= MIN_ANCHOR_KES) {
        return candidate;
      }

      // Keep the largest non-substantial transfer as a fallback.
      if (fallback === null || value > fallback.observed) {
        fallback = candidate;
      }
    }
  }

  return fallback;
}

/**
 * Fetches OUSD Transfer logs, degrading to 10-block chunks if the provider
 * rejects the range. Returns null when the span cannot be read at all.
 */
async function tryGetLogs(fromBlock: bigint, toBlock: bigint) {
  const query = (f: bigint, t: bigint) =>
    publicClient.getLogs({
      address: getTokenContract('ousd'),
      event: transferEvent,
      fromBlock: f,
      toBlock: t,
    });

  try {
    return await query(fromBlock, toBlock);
  } catch {
    const collected: Awaited<ReturnType<typeof query>> = [];
    for (let end = toBlock; end >= fromBlock; end -= 10n) {
      const start = end - 9n > fromBlock ? end - 9n : fromBlock;
      try {
        collected.push(...(await query(start, end)));
      } catch {
        return null;
      }
    }
    return collected;
  }
}

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const a = String(actual);
  const e = String(expected);
  const ok = a === e;
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(38)} ${a}${ok ? '' : ` (expected ${e})`}`);
}

function checkTrue(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
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
    where: { name: { in: ['Payout Check Merchant'] } },
    select: { id: true },
  });
  const merchantIds = merchants.map((merchant) => merchant.id);

  // Transactions before merchants and before wallets: the merchant FK is
  // ON DELETE SET NULL (so deleting the merchant first would strand the payment
  // row rather than remove it) and the wallet FK is RESTRICT.
  if (merchantIds.length > 0) {
    await prisma.transaction.deleteMany({ where: { merchantId: { in: merchantIds } } });
  }

  const user = await prisma.user.findUnique({ where: { email: 'payout-check@seti.test' } });
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
  console.log(`rate: ${quote.fiatPerUsd} KES/USD from "${quote.source}" (stale: ${quote.stale})`);

  const anchor = await findAnchor();
  if (!anchor) {
    if (batchMode) {
      console.error(
        'No batched OUSD transfer found on the configured network.\n\n' +
          'In batch mode this suite needs a real receipt containing BOTH the\n' +
          'merchant transfer and a fee transfer to SETI_TREASURY_ADDRESS, because\n' +
          'recordPayment refuses anything less. No such transaction exists yet\n' +
          'unless a batched payment has actually been made.\n\n' +
          'This is expected before the first batch: sign one on Moderato, or run\n' +
          'with FEE_ROUTING_MODE=inside-transfer to exercise the single-leg path.'
      );
    } else {
      console.error(
        'No recent OUSD transfer found on the configured network.\n' +
          'This suite needs a real on-chain transfer to reconcile against, so it\n' +
          'cannot run right now. Try again once OUSD has recent activity.'
      );
    }
    await prisma.$disconnect();
    process.exit(1);
  }

  const anchorKes = anchor.observed * quote.fiatPerUsd;
  console.log(`anchored on ${anchor.txHash}`);
  console.log(
    `  recipient ${anchor.recipient}, moved ${anchor.observed} OUSD (~KES ${anchorKes.toFixed(2)})`
  );
  if (anchorKes < MIN_ANCHOR_KES) {
    console.log(
      `  note: anchor is below KES ${MIN_ANCHOR_KES}; percentage assertions will be skipped`
    );
  }
  console.log('');

  const user = await prisma.user.upsert({
    where: { email: 'payout-check@seti.test' },
    update: {},
    create: { email: 'payout-check@seti.test' },
  });

  await prisma.wallet.upsert({
    where: { userId_asset_status: { userId: user.id, asset: 'ousd', status: 'active' } },
    update: {},
    create: {
      userId: user.id,
      chain: 'tempo',
      asset: 'ousd',
      address: `0xpayoutcheck${Date.now()}`,
    },
  });

  // payoutAddress MUST be the transfer's real recipient, or reconciliation
  // correctly rejects the payment and the fee arithmetic is never reached.
  const merchant = await prisma.merchant.create({
    data: { name: 'Payout Check Merchant', payoutAddress: anchor.recipient },
  });

  // Claim exactly what moved on the MERCHANT leg, so reconciliation's 1%
  // tolerance is satisfied. In batch mode that leg is the principal; in
  // inside-transfer mode it is the gross. Either way `amount` is compared
  // against this leg, so claiming anchor.observed is correct for both.
  const grossUsd = anchor.observed.toFixed(8);

  /**
   * The rate is FROZEN at quote time. Issue a quote from the same live rate this
   * suite recomputes its expectations from, so `recordPayment` writes figures
   * that the assertions below still predict — no assertion is weakened.
   */
  const quoteId = issueQuote({
    userId: user.id,
    fiatCurrency: quote.fiatCurrency,
    fiatPerUsd: quote.fiatPerUsd,
    source: quote.source,
    asOf: quote.asOf,
  });

  const recorded = await recordPayment({
    userId: user.id,
    amount: grossUsd,
    asset: 'ousd',
    merchantId: merchant.id,
    txHash: anchor.txHash,
    quoteId,
  });

  // Recompute the expectation independently from the on-chain amounts and the
  // live rate, rather than reusing the implementation's own helpers.
  //
  // The two modes differ in what the merchant leg means, so the expectation
  // differs: `inside-transfer` inverts the schedule to recover a principal from
  // a gross, whereas `batch` reads the principal directly off the merchant leg
  // and recovers the fee as the residue of (principal + fee).
  const observedPrincipal = anchor.observed;
  const observedGrossUsd = batchMode
    ? observedPrincipal + (anchor.feeObserved ?? 0)
    : observedPrincipal;

  const principalKesUsd = batchMode
    ? Math.round(observedPrincipal * quote.fiatPerUsd * 100) / 100
    : null;
  const grossFiat = Math.round(observedGrossUsd * quote.fiatPerUsd * 100) / 100;
  const expectedPrincipal =
    principalKesUsd ?? Math.ceil((grossFiat / 1.02) * 100) / 100;
  const expectedFee = Math.round((grossFiat - expectedPrincipal) * 100) / 100;

  console.log(
    `recorded ${observedGrossUsd} OUSD (= KES ${grossFiat.toFixed(2)} gross` +
      (batchMode
        ? `, principal KES ${expectedPrincipal}, fee leg ${anchor.feeObserved} OUSD):`
        : `):`)
  );
  check('fiatAmount (principal recovered)', Number(recorded.fiatAmount), expectedPrincipal);
  check('feeAmount', Number(recorded.feeAmount), expectedFee);
  check('merchantNetAmount == principal', Number(recorded.merchantNetAmount), expectedPrincipal);
  check(
    'gross == principal + fee',
    Number(recorded.fiatAmount) + Number(recorded.feeAmount),
    expectedPrincipal + expectedFee
  );
  check('feeCapped', recorded.feeCapped, false);
  check(
    'amount stored is the CHAIN figure',
    Number(recorded.amount),
    Number(observedGrossUsd.toFixed(8))
  );
  check('counterparty is the real recipient', recorded.counterparty, anchor.recipient);

  if (batchMode) {
    // The whole point of batch mode: the fee must be traceable to a real
    // on-chain transfer to the treasury, not merely computed. Assert the
    // observed leg is persisted so an audit can explain the figure later.
    const meta = (recorded.metadata ?? {}) as Record<string, unknown>;
    check(
      'fee routing mode is recorded on the row',
      meta.feeRoutingMode,
      'batch'
    );
    check(
      'observed treasury fee leg is persisted',
      Number(meta.treasuryFeeObserved),
      Number((anchor.feeObserved ?? 0).toFixed(8))
    );
  }
  check('fxRate persisted', Number(recorded.fxRate), quote.fiatPerUsd);
  check('fxRateSource persisted', recorded.fxRateSource, quote.source);
  checkTrue('fxRateAsOf set', recorded.fxRateAsOf !== null);
  check('status starts as processing', recorded.status, 'processing');

  // The fee must never reach the principal: that is what separates a percentage
  // from a flat KES charge, at any size. Dust payments round the fee to 0.00,
  // which still satisfies this. Compared numerically — check() does string
  // equality, which is meaningless for a relation.
  checkTrue(
    'fee is below principal (never a flat charge)',
    Number(recorded.feeAmount) < expectedPrincipal,
    `${Number(recorded.feeAmount)} < ${expectedPrincipal}`
  );

  if (expectedPrincipal >= MEANINGFUL_PRINCIPAL_KES) {
    // feeAmount is the RESIDUE (gross - principal), which is what reconciles
    // against the chain and keeps gross == principal + fee exact.
    // feeUncappedAmount is the schedule RECOMPUTED on the rounded principal.
    //
    // These legitimately differ by up to a cent whenever the principal does not
    // divide evenly by 1.02 — the ceil on the principal moves the schedule's
    // result by 0.01. Assert they agree to within that, NOT strict equality:
    // demanding equality would be asserting an arithmetic coincidence.
    // Compare in integer cents, not floats. The residue lands exactly on the 1c
    // boundary for some FX rates, and float subtraction is not exact there
    // (0.01 can compute as 0.0100000000002), so `<= 0.01` failed
    // nondeterministically depending on the live rate the check happened to fetch.
    const uncappedDeltaCents = Math.abs(
      Math.round(Number(recorded.feeUncappedAmount) * 100) - Math.round(expectedFee * 100)
    );
    checkTrue(
      'feeUncappedAmount within 1c of feeAmount (rounding residue)',
      uncappedDeltaCents <= 1,
      `delta ${(uncappedDeltaCents / 100).toFixed(2)} (${Number(recorded.feeUncappedAmount)} vs ${expectedFee})`
    );

    // The schedule's own figure must be the 2% of the principal, which is what
    // makes feeUncappedAmount meaningful for detecting a future cap.
    const expectedUncapped = Math.round(expectedPrincipal * 0.02 * 100) / 100;
    check('feeUncappedAmount is 2% of principal', Number(recorded.feeUncappedAmount), expectedUncapped);

    const effectivePct = (Number(recorded.feeAmount) / expectedPrincipal) * 100;
    checkTrue(
      'fee is ~2% of principal',
      Math.abs(effectivePct - 2) < 0.5,
      `${effectivePct.toFixed(3)}% of KES ${expectedPrincipal}`
    );
  } else {
    console.log(
      `skip  percentage assertions: principal KES ${expectedPrincipal} is below the\n` +
        `      KES ${MEANINGFUL_PRINCIPAL_KES} threshold where 2dp rounding dominates`
    );
  }

  // The audit trail must independently record the same figures.
  const audit = await prisma.auditLog.findFirst({
    where: { userId: user.id, action: 'payment.recorded' },
    orderBy: { createdAt: 'desc' },
  });
  const auditMeta = (audit?.metadata ?? {}) as Record<string, number | boolean>;
  console.log('\naudit trail:');
  check('audit feeFiat matches', auditMeta.feeFiat, expectedFee);
  check('audit merchantNet matches', auditMeta.merchantNet, expectedPrincipal);
  /*
   * The gross is what left the customer's wallet, and it differs by mode: the
   * principal leg alone in `inside-transfer`, the principal PLUS the treasury fee
   * in `batch`, where those are two separate transfers in one receipt. Comparing
   * against the principal in batch mode fails by exactly the fee.
   */
  const expectedGross = batchMode
    ? anchor.observed + (anchor.feeObserved ?? 0)
    : anchor.observed;
  check('audit records the gross', auditMeta.gross, expectedGross);
  checkTrue('audit fxRateSource present', Object.keys(auditMeta).includes('fxRateSource'));

  await teardown();

  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('payout check crashed:', error);
  // Tear down even on a crash. Tearing down only on the success path is how this
  // database accumulated orphan `Payout Check Merchant` rows: any thrown
  // assertion or provider hiccup skipped the cleanup and left the fixture for
  // the next run, and the next reader, to trip over.
  await teardownSafely();
  await prisma.$disconnect();
  process.exit(1);
});

