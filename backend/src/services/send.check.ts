/**
 * Send reconciliation checks: `recordSend` must verify the chain before it
 * writes anything, refuse when the fee was not actually collected, and bind the
 * row to the wallet that SIGNED the transfer rather than to whichever wallet a
 * lookup happens to find.
 *
 * Run with:  FEE_ROUTING_MODE=batch npm run check:send
 *
 * Requires live Postgres and an RPC, because every assertion here is about what
 * the chain recorded. The happy path is anchored on a REAL batched transaction
 * (`ANCHOR` below, produced by `npm run prove:batch`), so this suite exercises
 * `recordSend` against the same two-leg receipt a customer's wallet produces —
 * not against a stub.
 *
 * The anchor is PINNED BY HASH and read by hash, so its verdict depends on the
 * code rather than on how busy the chain happened to be: a receipt is immutable,
 * so a quiet chain cannot make it disappear. Override the hash with
 * `SEND_ANCHOR_TX` (e.g. a fresh `npm run prove:batch` receipt, when the default
 * anchor's sender has since been registered to another account). If the pinned
 * receipt cannot be read the suite FAILS LOUDLY naming the hash and the network —
 * it never skips its happy path, because a suite that skipped there would report
 * green while verifying nothing.
 *
 * The guard that matters most is the fee leg. A send that reaches the recipient
 * but not the treasury is the uncollected-fee failure wearing a new shape, and
 * it is the one a "did the money arrive?" test would happily pass.
 *
 * The second is the wallet binding, and the fixture is built to make the old bug
 * fail loudly: the account below holds TWO wallets — one ACTIVE (the row
 * `findActiveWallet` used to pick, and the wrong one) and one DEPRECATED holding
 * the address that actually signed. The recorded row must land on the signer.
 */
import { prisma } from '../lib/prisma.js';
import { decodeEventLog, erc20Abi, getAddress, parseAbiItem, type Hex, type TransactionReceipt } from 'viem';
import { recordSend, receivedSide } from './transactions.js';
import { PaymentRefusalError } from './payment-refusal.js';
import { getFxQuote } from './payments.js';
import { issueQuote } from './quote.js';
import { calculateMerchantFee } from './fees.js';
import { formatUnits, getTokenContract, network, publicClient, estimateNetworkFee } from './chain.js';
import { env } from '../config/env.js';

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/**
 * The typed refusal a record call produced, or a marker for "did not refuse".
 *
 * Refusals are the money path's contract, so an assertion on the CODE (not just
 * "it threw") is what pins them: `signer-not-declared` and `signer-not-owned`
 * are client-actionable states, and a suite that only checks "something threw"
 * cannot tell them from a crash.
 */
async function refusalOf(
  fn: () => Promise<unknown>
): Promise<{ code: string; message: string }> {
  try {
    await fn();
    return { code: '(did not refuse)', message: '' };
  } catch (error) {
    return {
      code:
        error instanceof PaymentRefusalError
          ? error.code
          : `non-refusal: ${error instanceof Error ? error.message : String(error)}`,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * The default anchor: a real batched transaction on Moderato: ONE transaction, two
 * transfers — 0.5 pathUSD to a throwaway recipient, and the 2% fee (0.01 pathUSD)
 * to SETI_TREASURY_ADDRESS. Signed and paid for by `npm run prove:batch`.
 *
 * Anchoring on it is what makes the happy path a statement about Tempo rather
 * than about this file: the receipt it points at was produced by a wallet, in
 * the shape the client signs, and it is immutable. The hash is overridable with
 * SEND_ANCHOR_TX (see the file header) so a fresh receipt can be pinned without
 * editing code.
 */
const DEFAULT_ANCHOR_TX = '0xfbbacc1e13943afd4627bdd848b945f4de706d5726679d9f16612693d9aa7c70';

const ANCHOR = {
  txHash: ((process.env.SEND_ANCHOR_TX ?? '').trim() || DEFAULT_ANCHOR_TX) as Hex,
  /**
   * The address that SIGNED the anchor: the receipt's `from`.
   *
   * A recorded transfer is bound to the wallet that signed it, so the fixture
   * must DECLARE this address and own the wallet row holding it — `Wallet.address`
   * is globally unique, so the signer's address has to be free. This anchor was
   * chosen for exactly that reason: the sender of the previous one
   * (`0x42A8…4155`, also a two-leg `prove:batch` receipt) is now registered to
   * another account, which makes it unusable by any fixture. If a `prove:batch`
   * run is ever made from a wallet that is already registered, pick a fresh
   * receipt the same way — the suite fails loudly rather than quietly.
   *
   * Re-asserted below against `receipt.from`, so a stale value fails as a
   * precondition rather than as a confusing reconciliation failure.
   */
  sender: '0xe71CD1DCE949838Ea4A5bd7Ac93F85c90257eBF4',
  recipient: '0xCf0048e57F37df356de63864D1AF1bEA81639ac8',
  principal: '0.5',
  asset: 'pathusd',
} as const;

/** A valid address no user holds, for the self-send refusal. */
const SELF_ADDRESS = getAddress('0x0000000000000000000000000000000000000001');
/**
 * A valid address this account does NOT own, for the not-owned refusal. Valid
 * 20-byte form so the refusal is about ownership, not about the shape.
 */
const STRANGER_ADDRESS = getAddress('0x0000000000000000000000000000000000009a9a');
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

/**
 * Reads the pinned anchor receipt BY HASH, failing LOUDLY when it cannot be used.
 *
 * The anchor is a fixed receipt, so a quiet chain cannot make it disappear: the
 * only reasons it is unreadable here are a wrong network/RPC or a receipt that is
 * not there at all. SKIPPING the happy path (which is what this suite used to do)
 * would then report green while verifying nothing about `recordSend` — so this
 * exits 1 with the hash and the network instead.
 */
async function readAnchorReceipt(hash: Hex): Promise<TransactionReceipt> {
  let receipt: TransactionReceipt | null = null;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash });
  } catch {
    receipt = null;
  }

  if (!receipt || receipt.status !== 'success') {
    console.error(
      `\nPinned send anchor ${hash} could not be read on ${network.displayName} ` +
        `(chain ${network.chainId}, ${network.rpcUrl})` +
        `${receipt ? ' — the transaction reverted' : ''}.\n` +
        'A recorded transfer is reconciled against this receipt, so without it the\n' +
        'suite cannot verify anything. Set SEND_ANCHOR_TX to a fresh batched pathUSD\n' +
        'receipt (npm run prove:batch), or fix the network/RPC.'
    );
    await teardownSafely();
    await prisma.$disconnect();
    process.exit(1);
  }

  const hasPathUsd = receipt.logs.some(
    (entry) => entry.address.toLowerCase() === getTokenContract('pathusd').toLowerCase()
  );
  if (!hasPathUsd) {
    console.error(
      `\nPinned send anchor ${hash} on ${network.displayName} carries no pathUSD transfer.\n` +
        'This suite reconciles a pathUSD send against it, so it is the wrong receipt.\n' +
        'Set SEND_ANCHOR_TX to a batched pathUSD receipt (npm run prove:batch).'
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

  // --- The account's TWO wallets: the bug, made explicit -------------------
  //
  // An account can hold several embedded wallets, and this fixture holds two:
  //
  //   * `otherWallet`  — ACTIVE, the row a lookup finds first. This is the one
  //                      the old code bound every recorded transfer to, and it is
  //                      NOT the wallet that signed the anchor.
  //   * `signerWallet` — DEPRECATED, holding ANCHOR.sender: the address the chain
  //                      recorded as the sender of the anchor. Deprecated is what
  //                      login does to a row when it registers a different
  //                      address, which is exactly how a real account ends up in
  //                      this shape — and why a lookup by status can never find
  //                      the signer.
  //
  // The row must land on `signerWallet`. Making the wrong wallet the ACTIVE one
  // (rather than relying on row order) is what keeps this deterministic.
  //
  // `SELF_ADDRESS` is a real, valid address (the self-send refusal runs through
  // EIP-55 validation first, so a placeholder string would be refused for the
  // wrong reason). Nothing signs with it.
  //
  // Both labels are deliberately NOT the asset the suite sends (`pathusd`), as
  // before: login registers every wallet as `ousd`, and a lookup that filtered on
  // the asset therefore refused every real send — after the money had left the
  // wallet — while a fixture labelled to match the transfer passed. Do not
  // "tidy" the mismatch into agreement.
  const otherWallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      chain: 'tempo',
      asset: 'ousd',
      address: SELF_ADDRESS,
      status: 'active',
    },
  });

  // The signer's address has to be FREE. `Wallet.address` is globally unique, and
  // a fixture cannot own an address another account holds — so if one does, this
  // fails loudly with the reason instead of turning into a P2002 that reads like
  // a broken suite. (It is not skipped silently: the binding is the point of
  // these assertions.)
  const signerAddress = getAddress(ANCHOR.sender);
  const signerTaken = await prisma.wallet.findUnique({ where: { address: signerAddress } });
  if (signerTaken && signerTaken.userId !== user.id) {
    console.error(
      `The anchor's sender ${signerAddress} is already registered to another account.\n` +
        'A recorded transfer is bound to the wallet that signed it, and an address\n' +
        'can belong to only one account, so this suite cannot declare it. Pick a\n' +
        'fresh batched receipt signed by an unregistered wallet (npm run prove:batch)\n' +
        'and update ANCHOR in this file.'
    );
    await teardownSafely();
    await prisma.$disconnect();
    process.exit(1);
  }

  const signerWallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      chain: 'tempo',
      asset: 'pathusd',
      address: signerAddress,
      status: 'deprecated',
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
  //
  // Read BY HASH, and read LOUDLY: `readAnchorReceipt` exits 1 with the hash and
  // the network if the pinned receipt cannot be used, so the happy path below
  // always runs. The suite can no longer go green with its most important
  // assertions skipped on a quiet chain.
  const anchorReceipt = await readAnchorReceipt(ANCHOR.txHash);

  // --- Guards that do not need a real receipt -------------------------------

  // FEE_ROUTING_MODE must be batch for the rest of this suite to mean anything,
  // so the declaration is supplied on every call. The declared address is a
  // real, DECLARED wallet of the account's — the signer's row.
  const signed = signerWallet.address;

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
      walletAddress: signed,
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
      // The self refusal compares the recipient with the wallet that SIGNED, so
      // the declaration here is the wallet the fixture says it signs with.
      walletAddress: SELF_ADDRESS,
    });
  } catch (error) {
    threw = true;
    message = error instanceof Error ? error.message : String(error);
  }
  check('a send to the sender\'s own wallet is refused', threw, message.slice(0, 70));
  check('and says the transfer would move nothing', /move nothing/i.test(message));
  check('no row written for a self-send', (await countRows()) === 0);

  // --- The wallet the row is bound to --------------------------------------
  //
  // A recorded transfer must be bound to the wallet that SIGNED it, and this
  // account holds two. Everything below asserts on `walletId`, which is the
  // binding: the row's own `mine` flags and totals are computed from it, so a
  // wrong binding is what made a real account's receipt read every leg as
  // `mine:false` with a total of 0.00.
  console.log('\nthe wallet that signed:');

  check(
    'the fixture account holds two wallets',
    (await prisma.wallet.count({ where: { userId: user.id } })) === 2
  );
  check(
    'the wallet a lookup by status finds is NOT the one that signed',
    otherWallet.id !== signerWallet.id &&
      otherWallet.status === 'active' &&
      signerWallet.status === 'deprecated',
    `active ${otherWallet.address} vs signer ${signerWallet.address}`
  );

  // 1. A declaration that MATCHES the receipt binds the row to that wallet.
  //    (Asserted on the real anchor in the happy path below.)

  // 2. A missing declaration is refused, not guessed.
  const undeclared = await refusalOf(() =>
    recordSend({
      userId: user.id,
      amount: ANCHOR.principal,
      asset: ANCHOR.asset,
      recipient: ANCHOR.recipient,
      txHash: ANCHOR.txHash,
      quoteId: sendQuoteId,
    })
  );
  check(
    'a record with no declared wallet is refused',
    undeclared.code === 'signer-not-declared',
    undeclared.code
  );
  check(
    'and it says which wallet cannot be resolved, not which amount failed',
    /does not say which wallet/i.test(undeclared.message),
    undeclared.message.slice(0, 78)
  );
  check('no row written without a declared wallet', (await countRows()) === 0);

  // 3. A declared address the caller does not own is refused.
  const foreign = await refusalOf(() =>
    recordSend({
      userId: user.id,
      amount: ANCHOR.principal,
      asset: ANCHOR.asset,
      recipient: ANCHOR.recipient,
      txHash: ANCHOR.txHash,
      quoteId: sendQuoteId,
      walletAddress: STRANGER_ADDRESS,
    })
  );
  check(
    'a declared wallet the account does not own is refused',
    foreign.code === 'signer-not-owned',
    foreign.code
  );
  check(
    'and the refusal says it does not belong to the account',
    /does not belong to this account/i.test(foreign.message),
    foreign.message.slice(0, 78)
  );
  check('no row written for a wallet the caller does not own', (await countRows()) === 0);

  // A malformed declaration is the same hole: unusable, so refused.
  const malformedDeclaration = await refusalOf(() =>
    recordSend({
      userId: user.id,
      amount: ANCHOR.principal,
      asset: ANCHOR.asset,
      recipient: ANCHOR.recipient,
      txHash: ANCHOR.txHash,
      quoteId: sendQuoteId,
      walletAddress: '0xnot-an-address',
    })
  );
  check(
    'an unusable declared wallet is refused',
    malformedDeclaration.code === 'signer-not-owned' &&
      /20-byte|checksum/i.test(malformedDeclaration.message),
    malformedDeclaration.code
  );

  // 4. A declared address that is not the receipt's sender is refused — on an
  //    otherwise PERFECT record call: same receipt, same recipient, same
  //    principal, same quote. The only difference from the happy path below is
  //    the declared wallet, so this fails for that reason alone.
  const notTheSender = await refusalOf(() =>
    recordSend({
      userId: user.id,
      amount: ANCHOR.principal,
      asset: ANCHOR.asset,
      recipient: ANCHOR.recipient,
      txHash: ANCHOR.txHash,
      quoteId: sendQuoteId,
      walletAddress: SELF_ADDRESS,
    })
  );
  check(
    'a declared wallet that did not sign the receipt is refused',
    notTheSender.code === 'signer-mismatch',
    notTheSender.code
  );
  check(
    'and the refusal names both the sender and the declared wallet',
    notTheSender.message.includes(getAddress(ANCHOR.sender)) &&
      notTheSender.message.includes(SELF_ADDRESS),
    notTheSender.message.slice(0, 96)
  );
  check('no row written when the declared wallet did not sign', (await countRows()) === 0);
  check(
    'and the refusal is recorded against its txHash with its code',
    (await prisma.auditLog.count({
      where: {
        userId: user.id,
        action: 'payment.rejected',
        txHash: ANCHOR.txHash,
        metadata: { path: ['code'], equals: 'signer-mismatch' },
      },
    })) === 1
  );

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
        // The declaration is a wallet of this account's. It is deliberately NOT
        // this receipt's real sender (a stranger's wallet, which no fixture
        // holds), so the refusal below can only come from the missing fee leg —
        // the sender check runs after the legs, before any write.
        walletAddress: signed,
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
        walletAddress: signed,
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

  {
    // No skip branch: `readAnchorReceipt` above already exited 1 (naming the hash
    // and the network) if the anchor could not be read, so everything here runs.
    // That is deliberate — a skipped happy path is a green suite that verified
    // nothing, which is worse than a red one.
    // Precondition for everything below: the anchor's sender is the address this
    // fixture declared, and it is NOT the account's active wallet. If the anchor
    // is re-created, update ANCHOR.sender — and this fails loudly rather than
    // turning into a confusing binding assertion.
    check(
      'the anchor receipt was signed by the declared wallet',
      anchorReceipt?.from?.toLowerCase() === signerWallet.address.toLowerCase(),
      `receipt.from ${anchorReceipt?.from} vs declared ${signerWallet.address}`
    );

    const transaction = await recordSend({
      userId: user.id,
      amount: ANCHOR.principal,
      asset: ANCHOR.asset,
      recipient: ANCHOR.recipient,
      txHash: ANCHOR.txHash,
      quoteId: sendQuoteId,
      walletAddress: signerWallet.address,
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

    // --- THE BUG: the row is bound to the wallet that SIGNED ---------------
    //
    // The account holds two wallets and the signer is the DEPRECATED one, so a
    // lookup by status (the old `findActiveWallet`) could only ever find the
    // other. This is the assertion that fails when that lookup comes back.
    check(
      'the row is bound to the wallet that SIGNED the transfer',
      transaction.walletId === signerWallet.id,
      `bound to ${transaction.walletId} (signer row ${signerWallet.id})`
    );
    check(
      'and NOT to the account\'s other wallet',
      transaction.walletId !== otherWallet.id,
      `other row ${otherWallet.id} (${otherWallet.address}, ${otherWallet.status})`
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
      'and it names the wallet the money actually came from',
      receivedRows[0]?.counterparty?.toLowerCase() === signerWallet.address.toLowerCase(),
      `counterparty ${receivedRows[0]?.counterparty} vs signer ${signerWallet.address}`
    );

    // Idempotent: a transfer cannot be recorded twice for one account, so a retry
    // (or the indexer walking the same block again) must not duplicate it.
    await receivedSide({
      recipient: getAddress(ANCHOR.recipient),
      amountAsset: Number(ANCHOR.principal),
      amountFiat: Number(ANCHOR.principal) * quote.fiatPerUsd,
      asset: ANCHOR.asset,
      txHash: ANCHOR.txHash,
      senderAddress: signerWallet.address,
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

  {
    // The anchor receipt is guaranteed here (readAnchorReceipt exited 1 otherwise),
    // so this is no longer a skip branch. `feePayment === undefined` below stays a
    // skip: it would only mean the pinned receipt paid no fee leg of its own, which
    // is a property of the receipt rather than of the code under test.
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
