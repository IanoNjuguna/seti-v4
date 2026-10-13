/**
 * Quote-freeze checks: the FX rate a preview showed is the rate the record path
 * writes, and a record that cannot present a valid signed quote refuses.
 *
 * Run with:  FEE_ROUTING_MODE=batch npm run check:quote
 *
 * Requires live Postgres and an RPC: the freeze is proven by recording a REAL
 * two-leg send (the same `ANCHOR` receipt `send.check.ts` uses) under a quote
 * whose rate is DELIBERATELY different from the live rate, and asserting the row
 * carries the frozen rate rather than the live one. That single assertion is the
 * one that fails if anyone reintroduces a live-rate lookup at record time.
 *
 * The fail-closed cases (missing / forged / expired / foreign) are refused
 * BEFORE any chain read, so they need no real receipt — only a wallet, a valid
 * recipient and an amount. Each is asserted both at the `readQuote` level and
 * through `recordSend`, so the client-facing refusal code is covered.
 */
import { prisma } from '../lib/prisma.js';
import { getAddress, type Hex } from 'viem';
import { recordSend } from './transactions.js';
import { getFxQuote, previewPayment } from './payments.js';
import { issueQuote, readQuote, QuoteError } from './quote.js';
import { PaymentRefusalError } from './payment-refusal.js';
import { getTokenContract, publicClient } from './chain.js';
import { env } from '../config/env.js';

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/**
 * A real batched transaction on Moderato: ONE transaction, two transfers —
 * 0.5 pathUSD to a throwaway recipient, and the 2% fee (0.01 pathUSD) to
 * SETI_TREASURY_ADDRESS. The same immutable anchor `send.check.ts` reconciles
 * against, reused here so the freeze is proven against a wallet-produced receipt
 * rather than a stub.
 */
const ANCHOR = {
  txHash: '0x913060ec28c168c38494bd5b725dea2778f93d34275c766447be2c45c68a9dcf' as Hex,
  recipient: '0x617C416110B328dB48030259c8664F29403Ce074',
  principal: '0.5',
  asset: 'pathusd',
} as const;

const CHECK_EMAIL = 'quote-check@seti.test';
const OTHER_EMAIL = 'quote-check-other@seti.test';
const MERCHANT_NAME = 'Quote Check Merchant';

/** A valid address no user holds — the sender's own wallet, distinct from the recipient. */
const SENDER_ADDRESS = getAddress('0x0000000000000000000000000000000000000002');

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The refusal code a record path returned, or a marker for "did not refuse". */
async function refusalCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return '(did not refuse)';
  } catch (error) {
    if (error instanceof PaymentRefusalError) return error.code;
    return `non-refusal: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** The typed code `readQuote` throws for a token, or a marker for "accepted it". */
function readQuoteCode(token: string | undefined, userId: string): string {
  try {
    readQuote(token, userId);
    return '(accepted)';
  } catch (error) {
    return error instanceof QuoteError
      ? error.code
      : `non-quote: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** Flips one character of the signature segment, leaving the payload intact. */
function forgeSignature(token: string): string {
  const [body, signature] = token.split('.');
  const last = signature.slice(-1);
  const flipped = last === 'A' ? 'B' : 'A';
  return `${body}.${signature.slice(0, -1)}${flipped}`;
}

async function teardown(): Promise<void> {
  const merchants = await prisma.merchant.findMany({
    where: { name: MERCHANT_NAME },
    select: { id: true },
  });
  const merchantIds = merchants.map((merchant) => merchant.id);

  if (merchantIds.length > 0) {
    await prisma.transaction.deleteMany({ where: { merchantId: { in: merchantIds } } });
  }

  for (const email of [CHECK_EMAIL, OTHER_EMAIL]) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.wallet.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  if (merchantIds.length > 0) {
    await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
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
      'skip  FEE_ROUTING_MODE is not "batch" — the freeze is proven through `recordSend`,\n' +
        '      which refuses every send outside batch mode. Run it as:\n' +
        '      FEE_ROUTING_MODE=batch npm run check:quote'
    );
    await prisma.$disconnect();
    process.exit(0);
  }

  const live = await getFxQuote();
  console.log(`fee routing mode: ${env.FEE_ROUTING_MODE}`);
  console.log(`live rate: ${live.fiatPerUsd} (${live.source})\n`);

  await teardown();

  const user = await prisma.user.create({ data: { email: CHECK_EMAIL } });
  await prisma.wallet.create({
    data: { userId: user.id, chain: 'tempo', asset: 'ousd', address: SENDER_ADDRESS },
  });
  const otherUser = await prisma.user.create({ data: { email: OTHER_EMAIL } });
  const merchant = await prisma.merchant.create({ data: { name: MERCHANT_NAME } });

  const countRows = () => prisma.transaction.count({ where: { userId: user.id } });

  // --- (a) a preview returns a quoteId -------------------------------------
  console.log('a preview carries a signed quote:');

  const preview = await previewPayment({
    userId: user.id,
    amountFiat: '250',
    asset: 'ousd',
    type: 'payment',
    merchantId: merchant.id,
  });

  check('the preview returns a quoteId', typeof preview.quoteId === 'string' && preview.quoteId.length > 0);

  const readPreview = readQuote(preview.quoteId, user.id);
  check(
    'and the token freezes the exact rate the preview displayed',
    readPreview.fiatPerUsd.toFixed(4) === preview.fxRate,
    `token ${readPreview.fiatPerUsd.toFixed(4)} vs preview ${preview.fxRate}`
  );

  // --- (b) the freeze: a valid quote with a DIFFERENT rate wins ------------
  console.log('\nthe rate shown is the rate recorded (the freeze):');

  const anchorReceipt = await publicClient
    .getTransactionReceipt({ hash: ANCHOR.txHash })
    .catch(() => null);
  const anchorUsable =
    anchorReceipt?.status === 'success' &&
    anchorReceipt.logs.some(
      (entry) => entry.address.toLowerCase() === getTokenContract('pathusd').toLowerCase()
    );

  // Deliberately far from the live rate, so a row that carried the live rate
  // instead of the frozen one is unmissable.
  const frozenRate = live.fiatPerUsd * 1.5;
  const frozenRateDisplay = frozenRate.toFixed(8);

  const frozenQuote = issueQuote({
    userId: user.id,
    fiatCurrency: live.fiatCurrency,
    fiatPerUsd: frozenRate,
    source: 'quote-check-frozen',
    asOf: live.asOf,
  });

  check(
    'the frozen rate is deliberately different from the live rate',
    Math.abs(Number(frozenRateDisplay) - Number(live.fiatPerUsd.toFixed(8))) > 1,
    `frozen ${frozenRateDisplay} vs live ${live.fiatPerUsd.toFixed(8)}`
  );

  if (!anchorUsable) {
    console.log(
      'skip  the anchor receipt is not readable on this chain. Run `npm run prove:batch`\n' +
        '      to produce one, then update ANCHOR in this file.'
    );
  } else {
    const recorded = await recordSend({
      userId: user.id,
      amount: ANCHOR.principal,
      asset: ANCHOR.asset,
      recipient: ANCHOR.recipient,
      txHash: ANCHOR.txHash,
      quoteId: frozenQuote,
    });

    const observedPrincipal = Number(ANCHOR.principal);
    const expectedFiat = round2(observedPrincipal * frozenRate).toFixed(2);

    check(
      'the row carries the FROZEN rate, not the live rate',
      Number(recorded.fxRate) === Number(frozenRateDisplay),
      `recorded ${Number(recorded.fxRate)} vs frozen ${frozenRateDisplay}`
    );
    check(
      'and that rate is NOT the rate a live lookup would have produced',
      Number(recorded.fxRate) !== Number(live.fiatPerUsd.toFixed(8)),
      `recorded ${Number(recorded.fxRate)} vs live ${live.fiatPerUsd.toFixed(8)}`
    );
    check(
      'the frozen source is carried onto the row',
      recorded.fxRateSource === 'quote-check-frozen',
      String(recorded.fxRateSource)
    );
    check(
      'every fiat figure is derived from the frozen rate',
      recorded.fiatAmount?.toFixed(2) === expectedFiat,
      `fiatAmount ${recorded.fiatAmount?.toFixed(2)} vs ${expectedFiat}`
    );
    check('exactly one row was written', (await countRows()) === 1);
  }

  // --- (g) the quote is a rate promise, not a nonce: reusable within its TTL -
  console.log('\nreuse within the TTL:');

  const reuseA = readQuote(frozenQuote, user.id);
  const reuseB = readQuote(frozenQuote, user.id);
  check(
    'a quote can be read twice (not single-use)',
    reuseA.fiatPerUsd === reuseB.fiatPerUsd && reuseA.fiatPerUsd === frozenRate,
    `${reuseA.fiatPerUsd} / ${reuseB.fiatPerUsd}`
  );
  check(
    'and it still verifies after the record path used it',
    readQuoteCode(frozenQuote, user.id) === '(accepted)'
  );

  // --- (c)-(f) fail closed: missing / forged / expired / foreign -----------
  console.log('\nfail closed without a usable quote:');

  const rowsBeforeRefusals = await countRows();

  const forged = forgeSignature(frozenQuote);
  const expired = issueQuote({
    userId: user.id,
    fiatCurrency: live.fiatCurrency,
    fiatPerUsd: live.fiatPerUsd,
    source: live.source,
    asOf: live.asOf,
    ttlSeconds: -1,
  });
  const foreign = issueQuote({
    userId: otherUser.id,
    fiatCurrency: live.fiatCurrency,
    fiatPerUsd: live.fiatPerUsd,
    source: live.source,
    asOf: live.asOf,
  });

  check('a forged signature reads as quote-invalid', readQuoteCode(forged, user.id) === 'quote-invalid');
  check('an expired quote reads as quote-expired', readQuoteCode(expired, user.id) === 'quote-expired');
  check('another user\'s quote reads as quote-not-yours', readQuoteCode(foreign, user.id) === 'quote-not-yours');
  check('a missing token reads as quote-missing', readQuoteCode(undefined, user.id) === 'quote-missing');

  const base = { userId: user.id, amount: ANCHOR.principal, asset: ANCHOR.asset, recipient: ANCHOR.recipient };

  const forgedRefusal = await refusalCode(() =>
    recordSend({ ...base, txHash: `0x${'33'.repeat(32)}`, quoteId: forged })
  );
  check('recordSend refuses a forged quote', forgedRefusal === 'quote-invalid', forgedRefusal);

  const expiredRefusal = await refusalCode(() =>
    recordSend({ ...base, txHash: `0x${'44'.repeat(32)}`, quoteId: expired })
  );
  check('recordSend refuses an expired quote', expiredRefusal === 'quote-expired', expiredRefusal);

  const foreignRefusal = await refusalCode(() =>
    recordSend({ ...base, txHash: `0x${'55'.repeat(32)}`, quoteId: foreign })
  );
  check('recordSend refuses another user\'s quote', foreignRefusal === 'quote-not-yours', foreignRefusal);

  const missingRefusal = await refusalCode(() =>
    recordSend({ ...base, txHash: `0x${'66'.repeat(32)}` })
  );
  check('recordSend refuses a missing quoteId', missingRefusal === 'quote-missing', missingRefusal);

  check(
    'no row was written for any refused quote (fail closed)',
    (await countRows()) === rowsBeforeRefusals,
    `${await countRows()} rows vs ${rowsBeforeRefusals} before`
  );

  await teardown();
  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('quote check crashed:', error);
  await teardownSafely();
  await prisma.$disconnect();
  process.exit(1);
});
