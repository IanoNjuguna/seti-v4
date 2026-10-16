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
 *
 * The anchor is PINNED BY HASH and read by hash, so the freeze is proven against
 * an immutable receipt rather than on what happened to be on chain: a quiet chain
 * cannot make a receipt disappear. Override the hash with `QUOTE_ANCHOR_TX` (a
 * fresh `npm run prove:batch` receipt). If the pinned receipt cannot be read the
 * suite FAILS LOUDLY naming the hash and the network — it never skips the freeze,
 * because a suite that skipped there would report green while proving nothing.
 */
import { prisma } from '../lib/prisma.js';
import { getAddress, type Hex, type TransactionReceipt } from 'viem';
import { recordSend } from './transactions.js';
import { getFxQuote, previewPayment } from './payments.js';
import { issueQuote, readQuote, QuoteError } from './quote.js';
import { PaymentRefusalError } from './payment-refusal.js';
import { getTokenContract, networkConfigFor, publicClientFor } from './chain.js';
import { env } from '../config/env.js';
import type { Network } from '../lib/network.js';
import { anchorNetworkPermitsRun } from './anchor-network.js';

/**
 * THE NETWORK THE PINNED ANCHOR RECEIPT IS ON — Practice, deliberately.
 *
 * The receipts this suite reconciles against are Moderato batches: no mainnet batch
 * carries both legs yet (see `docs/internal/mainnet-flip.md`). Naming the network
 * the anchor lives on — rather than inheriting whatever this box SERVES — is what
 * makes the suite's verdict depend on the code: the receipt is read through a client
 * for THIS network, every quote is minted for it, and every `recordSend` below is
 * recorded on it. A quote minted for one network and read on the other is refused
 * (`quote-wrong-network`), which is the hazard this closes.
 *
 * To move the suite to mainnet, pin a real mainnet batched receipt (QUOTE_ANCHOR_TX)
 * AND change this constant.
 */
const ANCHOR_NETWORK: Network = 'testnet';
const anchorNetwork = networkConfigFor(ANCHOR_NETWORK);
const anchorPublicClient = publicClientFor(ANCHOR_NETWORK);

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/**
 * The default anchor: a real batched transaction on Moderato: ONE transaction,
 * two transfers — 0.5 OUSD to a throwaway recipient, and the 2% fee (0.01 OUSD)
 * to SETI_TREASURY_ADDRESS. The same immutable anchor `send.check.ts` reconciles
 * against, reused here so the freeze is proven against a wallet-produced receipt
 * rather than a stub. OUSD is the asset the app signs, so the receipt the freeze
 * is proven against matches what the client produces.
 *
 * The hash is overridable with QUOTE_ANCHOR_TX (see the file header) so a fresh
 * receipt can be pinned without editing code.
 */
const DEFAULT_ANCHOR_TX = '0xe58f82dfd016ad6d1823dde4183d386bf0c62d59cf4de6706f45b9cab39186f0';

const ANCHOR = {
  txHash: ((process.env.QUOTE_ANCHOR_TX ?? '').trim() || DEFAULT_ANCHOR_TX) as Hex,
  /**
   * The address that SIGNED the anchor: the receipt's `from`.
   *
   * The fixture declares this on every record call, because a recorded transfer is
   * bound to the wallet that signed it — and `Wallet.address` is globally unique,
   * so the signer's address has to be one no other account holds. `prove:batch`
   * generates a throwaway key each run, so its sender is free by construction.
   */
  sender: '0x57105d4e8c5fD5e868c2B60342580724Ba3fBb92',
  recipient: '0x4111Cc6F2EaE3860e5A4CEF90A42C0572A19e127',
  principal: '0.5',
  asset: 'ousd',
} as const;

const CHECK_EMAIL = 'quote-check@seti.test';
const OTHER_EMAIL = 'quote-check-other@seti.test';
const MERCHANT_NAME = 'Quote Check Merchant';

/** The wallet that signs — the anchor's sender. See ANCHOR.sender. */
const SENDER_ADDRESS = getAddress(ANCHOR.sender);

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
    readQuote(token, userId, ANCHOR_NETWORK);
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

/**
 * Reads the pinned anchor receipt BY HASH, failing LOUDLY when it cannot be used.
 *
 * The anchor is a fixed receipt, so a quiet chain cannot make it disappear: the
 * only reasons it is unreadable here are a wrong network/RPC or a receipt that is
 * not there at all. SKIPPING the freeze (which is what this suite used to do)
 * would then report green while proving nothing, so this exits 1 with the hash and
 * the network instead.
 */
async function readAnchorReceipt(hash: Hex): Promise<TransactionReceipt> {
  let receipt: TransactionReceipt | null = null;
  try {
    receipt = await anchorPublicClient.getTransactionReceipt({ hash });
  } catch {
    receipt = null;
  }

  if (!receipt || receipt.status !== 'success') {
    console.error(
      `\nPinned quote anchor ${hash} could not be read on ${anchorNetwork.displayName} ` +
        `(chain ${anchorNetwork.chainId}, ${anchorNetwork.rpcUrl})` +
        `${receipt ? ' — the transaction reverted' : ''}.\n` +
        'The rate freeze is proven by recording a real two-leg send against this\n' +
        'receipt, so without it the suite cannot run. Set QUOTE_ANCHOR_TX to a fresh\n' +
        'batched OUSD receipt (npm run prove:batch), or fix the network/RPC.'
    );
    await teardownSafely();
    await prisma.$disconnect();
    process.exit(1);
  }

  const hasAnchorAsset = receipt.logs.some(
    (entry) => entry.address.toLowerCase() === getTokenContract(ANCHOR.asset).toLowerCase()
  );
  if (!hasAnchorAsset) {
    console.error(
      `\nPinned quote anchor ${hash} on ${anchorNetwork.displayName} carries no ${ANCHOR.asset} transfer.\n` +
        `The freeze is proven against a ${ANCHOR.asset} send, so this is the wrong receipt.\n` +
        'Set QUOTE_ANCHOR_TX to a batched OUSD receipt (npm run prove:batch).'
    );
    await teardownSafely();
    await prisma.$disconnect();
    process.exit(1);
  }

  return receipt;
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

  // The anchor is a Moderato receipt; this suite names the network its anchor is
  // on and refuses to run when the deployment serves a different one. On mainnet no
  // mainnet anchor is pinned yet, so it SKIPS — loudly, naming why — rather than
  // reconcile a Moderato receipt against a mainnet-serving ledger. See
  // `anchor-network.ts`.
  if (
    !anchorNetworkPermitsRun({ suite: 'check:quote', kind: 'quote', anchorNetwork: ANCHOR_NETWORK })
  ) {
    await prisma.$disconnect();
    process.exit(0);
  }

  const live = await getFxQuote();
  console.log(`fee routing mode: ${env.FEE_ROUTING_MODE}`);
  console.log(`live rate: ${live.fiatPerUsd} (${live.source})\n`);

  await teardown();

  const user = await prisma.user.create({ data: { email: CHECK_EMAIL } });

  // The fixture registers the address that SIGNED the anchor and declares it on
  // every record below: the wallet a transfer is bound to is the one that signed
  // it, and only the client knows which of an account's wallets it used.
  // `Wallet.address` is globally unique, so a row another account holds cannot be
  // used — fail loudly with the reason rather than a bare P2002.
  const signerTaken = await prisma.wallet.findFirst({ where: { address: SENDER_ADDRESS } });
  if (signerTaken && signerTaken.userId !== user.id) {
    console.error(
      `The anchor's sender ${SENDER_ADDRESS} is already registered to another account, so\n` +
        'this suite cannot declare the wallet that signed it. Pick a fresh batched\n' +
        'receipt signed by an unregistered wallet (npm run prove:batch) and update\n' +
        'ANCHOR in this file.'
    );
    await teardown();
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.wallet.create({
    data: {
      userId: user.id,
      chain: 'tempo',
      asset: 'ousd',
      address: SENDER_ADDRESS,
      network: ANCHOR_NETWORK,
    },
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
    // Priced FOR the network this suite records on, so the quote it mints is
    // readable there (a quote is network-scoped).
    network: ANCHOR_NETWORK,
  });

  check('the preview returns a quoteId', typeof preview.quoteId === 'string' && preview.quoteId.length > 0);

  const readPreview = readQuote(preview.quoteId, user.id, ANCHOR_NETWORK);
  check(
    'and the token freezes the exact rate the preview displayed',
    readPreview.fiatPerUsd.toFixed(4) === preview.fxRate,
    `token ${readPreview.fiatPerUsd.toFixed(4)} vs preview ${preview.fxRate}`
  );

  // --- (b) the freeze: a valid quote with a DIFFERENT rate wins ------------
  console.log('\nthe rate shown is the rate recorded (the freeze):');

  // --- The anchor must be readable: read it BY HASH and LOUDLY ---------------
  //
  // `readAnchorReceipt` exits 1 with the hash and the network if the pinned
  // receipt cannot be used, so the freeze below always runs against a real
  // receipt. The suite can no longer go green with its headline assertion skipped.
  await readAnchorReceipt(ANCHOR.txHash);

  // Deliberately far from the live rate, so a row that carried the live rate
  // instead of the frozen one is unmissable.
  const frozenRate = live.fiatPerUsd * 1.5;
  const frozenRateDisplay = frozenRate.toFixed(8);

  const frozenQuote = issueQuote({
    userId: user.id,
    network: ANCHOR_NETWORK,
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

  {
    // No skip branch: `readAnchorReceipt` above already exited 1 if the anchor
    // could not be read, so the freeze always runs against a real receipt.
    const recorded = await recordSend({
      userId: user.id,
      amount: ANCHOR.principal,
      asset: ANCHOR.asset,
      recipient: ANCHOR.recipient,
      txHash: ANCHOR.txHash,
      quoteId: frozenQuote,
      // Recorded ON the network the receipt is on.
      network: ANCHOR_NETWORK,
      // The wallet that signed the anchor. The record path checks it belongs to
      // this account AND that the chain recorded it as this transaction's sender.
      walletAddress: SENDER_ADDRESS,
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

  const reuseA = readQuote(frozenQuote, user.id, ANCHOR_NETWORK);
  const reuseB = readQuote(frozenQuote, user.id, ANCHOR_NETWORK);
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
    network: ANCHOR_NETWORK,
    fiatCurrency: live.fiatCurrency,
    fiatPerUsd: live.fiatPerUsd,
    source: live.source,
    asOf: live.asOf,
    ttlSeconds: -1,
  });
  const foreign = issueQuote({
    userId: otherUser.id,
    network: ANCHOR_NETWORK,
    fiatCurrency: live.fiatCurrency,
    fiatPerUsd: live.fiatPerUsd,
    source: live.source,
    asOf: live.asOf,
  });

  check('a forged signature reads as quote-invalid', readQuoteCode(forged, user.id) === 'quote-invalid');
  check('an expired quote reads as quote-expired', readQuoteCode(expired, user.id) === 'quote-expired');
  check('another user\'s quote reads as quote-not-yours', readQuoteCode(foreign, user.id) === 'quote-not-yours');
  check('a missing token reads as quote-missing', readQuoteCode(undefined, user.id) === 'quote-missing');

  const base = {
    userId: user.id,
    amount: ANCHOR.principal,
    asset: ANCHOR.asset,
    recipient: ANCHOR.recipient,
    // Recorded on the network the anchor receipt is on.
    network: ANCHOR_NETWORK,
    // Declared on every call: the wallet binding is a precondition of the record
    // path, so a refusal below has to be about the QUOTE, not about the wallet.
    walletAddress: SENDER_ADDRESS,
  };

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
