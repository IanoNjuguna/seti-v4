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
 * (`deriveSendAnchor` below, produced by `npm run prove:batch`), so this suite
 * exercises `recordSend` against the same two-leg receipt a customer's wallet
 * produces — not against a stub.
 *
 * WHICH ANCHOR, AND ON WHICH CHAIN
 * -------------------------------
 * The anchor is the receipt this deployment's served network pins:
 *
 *   serving practice → `TEMPO_TESTNET_SEND_ANCHOR_TX`, else the pinned Moderato
 *                      OUSD batch this suite has always reconciled;
 *   serving live     → `TEMPO_MAINNET_SEND_ANCHOR_TX`. Nothing else: a practice
 *                      receipt proves nothing about chain 4217.
 *
 * `ANCHOR_NETWORK` is therefore the SERVED network, so `anchorNetworkPermitsRun`
 * holds by construction — a receipt is read and reconciled only on the chain it
 * lives on. When the served network has NO anchor pinned, the suite SKIPS
 * loudly, naming the chain, and exits 0: that is not a pass and it must not
 * pretend to be one.
 *
 * THE FIXTURE IS DERIVED FROM THE RECEIPT, NOT DECLARED
 * ----------------------------------------------------
 * The signer is `receipt.from`; the principal is the largest transfer that is
 * neither the gas fee recipient (`0xfeec…`) nor the treasury; its recipient is
 * that transfer's `to`; the asset is resolved from that transfer's token address
 * through the per-chain asset table (see `services/send-anchor.ts`). Nothing
 * here names an address, an amount or an asset, which is what lets a mainnet
 * anchor be reconciled by pinning it — no constant edits, no chance of the
 * fixture and the receipt disagreeing.
 *
 * The anchor is PINNED BY HASH and read by hash, so its verdict depends on the
 * code rather than on how busy the chain happened to be: a receipt is immutable,
 * so a quiet chain cannot make it disappear. If the pinned receipt cannot be read
 * the suite FAILS LOUDLY naming the hash and the network — it never skips its
 * happy path, because a suite that skipped there would report green while
 * verifying nothing.
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
import {
  FEE_AMM_ADDRESS,
  formatUnits,
  getTokenContract,
  networkConfigFor,
  publicClientFor,
  estimateNetworkFee,
  servedNetwork,
} from './chain.js';
import { treasuryAddressFor } from '../config/networks.js';
import { env } from '../config/env.js';
import type { Network } from '../lib/network.js';
import { anchorNetworkPermitsRun } from './anchor-network.js';
import { deriveSendAnchor, type DerivedSendAnchor } from './send-anchor.js';

/**
 * THE NETWORK THE PINNED ANCHOR RECEIPT IS ON — the network this deployment
 * SERVES.
 *
 * A receipt is per CHAIN, so the anchor must come from the chain the ledger this
 * suite records against lives on. Naming the served network (rather than a
 * constant) is what lets the same suite reconcile a Moderato receipt on a
 * practice deployment and a mainnet receipt on the live one, with no
 * cross-network mix possible: the receipt is read through THIS network's client,
 * every fixture wallet is registered on it, and every `recordSend` below is
 * recorded on it through `recordOnAnchorNetwork`.
 */
const ANCHOR_NETWORK: Network = servedNetwork;
const anchorNetwork = networkConfigFor(ANCHOR_NETWORK);
const anchorPublicClient = publicClientFor(ANCHOR_NETWORK);

/**
 * `recordSend` with this suite's network filled in.
 *
 * Every call below is a case about the RECORD PATH — a malformed recipient, a
 * self-send, a missing fee leg — and each has to be refused for what it is testing
 * rather than for the network this box happens to serve. Filling the network in at
 * one place keeps the call sites about their case, and makes it impossible to add
 * one that silently inherits the served network.
 */
function recordOnAnchorNetwork(input: Parameters<typeof recordSend>[0]) {
  return recordSend({ ...input, network: ANCHOR_NETWORK });
}

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
 * The practice anchor this suite has always reconciled against: a real batched
 * transaction on Moderato — ONE transaction, two transfers, 0.5 OUSD to a
 * throwaway recipient and the 2% fee (0.01 OUSD) to the treasury — signed and
 * paid for by `npm run prove:batch`.
 *
 * It is the FALLBACK, used only when this deployment serves practice and no
 * per-network hash is pinned. It is deliberately not `ANCHOR_DEFAULTS`'
 * `testnet.send` from `config/networks.ts`: that value is the batched PATHUSD
 * receipt `check:quote` uses, and reconciling OUSD against it would fail on the
 * asset. Keeping the OUSD receipt here is what makes practice behaviour
 * unchanged.
 */
const PINNED_PRACTICE_ANCHOR =
  '0xe58f82dfd016ad6d1823dde4183d386bf0c62d59cf4de6706f45b9cab39186f0';

/**
 * The per-network anchor variables, read once, in one place.
 *
 * `config/env.ts` declares them; naming them here as a map (rather than building
 * the key by string interpolation) is what makes the two values the ONLY way an
 * anchor can be pinned — a third spelling cannot quietly appear.
 */
const SEND_ANCHOR_ENV: Record<Network, string | undefined> = {
  testnet: env.TEMPO_TESTNET_SEND_ANCHOR_TX,
  mainnet: env.TEMPO_MAINNET_SEND_ANCHOR_TX,
};

/**
 * The anchor hash this deployment's served network pins, or undefined when that
 * network has none.
 *
 * The hash comes from the per-network variable above — `TEMPO_TESTNET_SEND_ANCHOR_TX`
 * / `TEMPO_MAINNET_SEND_ANCHOR_TX` — so an anchor belongs to exactly one chain and
 * pinning a mainnet receipt cannot point a practice run at chain 4217. The shared
 * `SEND_ANCHOR_TX` is deliberately NOT consulted: it names no chain, and it is
 * what made it possible to read one network's receipt while recording against
 * another.
 *
 * Practice additionally carries its long-standing default; the live network
 * carries none until a real mainnet batch receipt exists, which is the honest
 * state — see `anchorNetworkPermitsRun` and `docs/internal/mainnet-flip.md`.
 */
function pinnedSendAnchor(target: Network): Hex | undefined {
  const pinned = (SEND_ANCHOR_ENV[target] ?? '').trim();
  if (pinned) return pinned as Hex;
  return target === 'testnet' ? PINNED_PRACTICE_ANCHOR : undefined;
}

/**
 * The fixture, DERIVED from the pinned receipt (see `services/send-anchor.ts`).
 *
 * Assigned once in `main`, after the receipt has been read on the served chain.
 * Every use below reads a fact the chain recorded — there is no address, amount
 * or asset in this file to go stale.
 */
let anchor: DerivedSendAnchor;

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
 * transfer that is itself a fee. The address itself lives in `services/chain.ts`
 * — this is the same value, compared in one case so a log and the constant
 * cannot disagree about casing.
 */
const FEE_RECIPIENT = FEE_AMM_ADDRESS.toLowerCase();

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

/**
 * Finds a recent transfer, in the ANCHOR's asset, that is NOT part of the anchor.
 *
 * Used for the realistic "recipient got paid, treasury did not" case: a plain
 * transfer has a principal leg and no fee leg, which is exactly the shape the
 * guard has to catch. Walking in 10-block chunks because the provider caps the
 * range a single `getLogs` may cover.
 *
 * The token is resolved ON THE ANCHOR NETWORK: on a mainnet deployment the
 * served-network lookup would ask for the same address anyway, but on any
 * mismatch it would scan a contract that is not the one the anchor spends.
 */
async function findRecentTransfer(): Promise<string | null> {
  const head = await anchorPublicClient.getBlockNumber();
  const CHUNK = 10n;
  const token = getTokenContract(anchor.asset, ANCHOR_NETWORK);

  for (let end = head; end > head - 20_000n; end -= CHUNK) {
    try {
      const logs = await anchorPublicClient.getLogs({
        address: token,
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
  const receipt = await anchorPublicClient.getTransactionReceipt({ hash: txHash });
  const token = getTokenContract(anchor.asset, ANCHOR_NETWORK).toLowerCase();

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
 *
 * It does NOT validate the receipt's contents: whether the receipt can anchor a
 * send is decided by `deriveSendAnchor`, which refuses a receipt with no treasury
 * leg, no payment leg, or a token the chain's asset table does not know — named
 * failures rather than a mismatch between two copies of the fixture.
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
      `\nPinned send anchor ${hash} could not be read on ${anchorNetwork.displayName} ` +
        `(chain ${anchorNetwork.chainId}, ${anchorNetwork.rpcUrl})` +
        `${receipt ? ' — the transaction reverted' : ''}.\n` +
        'A recorded transfer is reconciled against this receipt, so without it the\n' +
        'suite cannot verify anything. Pin a batched receipt on THIS network as ' +
        `TEMPO_${ANCHOR_NETWORK.toUpperCase()}_SEND_ANCHOR_TX\n` +
        '(`npm run prove:batch` prints the line to pin), or fix the network/RPC.'
    );
    await teardownSafely();
    await prisma.$disconnect();
    process.exit(1);
  }

  return receipt;
}

/**
 * Refuses to run when the address the fixture needs to own already belongs to an
 * account — LOUDLY, naming the collision.
 *
 * `wallets` is unique on `address` PER NETWORK, so an address can only be
 * declared by the account that holds it on the network the send is recorded on.
 * A collision here is a real signal, not an obstacle to work around: the pinned
 * receipt was signed by a wallet that is already someone's, so the honest
 * response is a fresh receipt (or a free address), never a fixture that quietly
 * records one account's transfer against another's wallet.
 */
async function assertAddressIsFree(address: string, role: string): Promise<void> {
  const taken = await prisma.wallet.findFirst({
    where: { address: { equals: address, mode: 'insensitive' }, network: ANCHOR_NETWORK },
  });

  if (!taken) return;

  console.error(
    `\nThe anchor's ${role} ${address} is already a wallet row on ` +
      `${ANCHOR_NETWORK} (account ${taken.userId}).\n` +
      `A recorded transfer is bound to the wallet that signed it, and an address can\n` +
      `belong to only one account per network, so this suite cannot declare it.\n` +
      `Pin a fresh batched receipt signed by an unregistered wallet (npm run prove:batch)\n` +
      `as TEMPO_${ANCHOR_NETWORK.toUpperCase()}_SEND_ANCHOR_TX — the fixture is derived from the\n` +
      'receipt, so no constant needs editing.'
  );
  await teardownSafely();
  await prisma.$disconnect();
  process.exit(1);
}

async function main(): Promise<void> {
  if (env.FEE_ROUTING_MODE !== 'batch') {
    console.log(
      'skip  FEE_ROUTING_MODE is not "batch" — `recordSend` refuses every send there,\n' +
        '      which is the point of it, but it makes the rest of this suite unreachable.\n' +
        '      Run it as: FEE_ROUTING_MODE=batch npm run check:send'
    );
    await prisma.$disconnect();
    process.exit(0);
  }

  // --- Which receipt, on which chain --------------------------------------
  //
  // The anchor is the served network's own pinned receipt, so the invariant below
  // holds by construction: this suite never reconciles a receipt from a chain it
  // is not serving. What it CANNOT do is invent one — the live network has no
  // batched receipt until an operator makes one — so the honest outcome there is
  // a loud SKIP that names the chain, never a pass and never a failure.
  const anchorHash = pinnedSendAnchor(ANCHOR_NETWORK);

  if (!anchorHash) {
    console.error(
      `\nskip  check:send: this deployment serves ${anchorNetwork.label} ` +
        `(${ANCHOR_NETWORK}, chain ${anchorNetwork.chainId}) and NO send anchor is pinned\n` +
        `      for it. A receipt is per CHAIN, so a receipt from the other network proves\n` +
        '      nothing here — and reconciling one would record a transfer the served chain\n' +
        '      never made.\n' +
        `      Pin a real batched receipt on ${anchorNetwork.label} as ` +
        `TEMPO_${ANCHOR_NETWORK.toUpperCase()}_SEND_ANCHOR_TX.\n` +
        '      On Live that is: npm run prove:batch -- --network=mainnet --confirm-real-money\n' +
        '      — it prints the exact line to pin on success.\n' +
        '      SKIPPED — NOT passed: nothing about send reconciliation was verified.'
    );
    await prisma.$disconnect();
    process.exit(0);
  }

  // The invariant, asked AFTER an anchor is known to exist: a pinned receipt runs
  // only on the chain it lives on. With `ANCHOR_NETWORK` being the served network
  // this is true by construction — the call is kept as the assertion of that, and
  // it prints which chain this run verified on.
  if (
    !anchorNetworkPermitsRun({ suite: 'check:send', kind: 'send', anchorNetwork: ANCHOR_NETWORK })
  ) {
    await prisma.$disconnect();
    process.exit(0);
  }

  const anchorReceipt = await readAnchorReceipt(anchorHash);

  // The fixture, read off the receipt. A receipt that cannot anchor a send (no
  // treasury leg, no payment leg, an unsupported token) is refused HERE, with the
  // reason, rather than becoming a confusing reconciliation failure later.
  try {
    anchor = deriveSendAnchor(anchorReceipt, ANCHOR_NETWORK);
  } catch (error) {
    console.error(
      `\nPinned send anchor ${anchorHash} on ${anchorNetwork.displayName} cannot anchor a send:\n  ` +
        `${(error as Error).message}\n` +
        'This suite reconciles a two-leg batched send against it, so the receipt must carry\n' +
        'both the principal and the fee to the treasury.'
    );
    await teardownSafely();
    await prisma.$disconnect();
    process.exit(1);
  }

  const quote = await getFxQuote();
  console.log(`fee routing mode: ${env.FEE_ROUTING_MODE}`);
  console.log(`network: ${anchorNetwork.displayName} (${ANCHOR_NETWORK}, chain ${anchorNetwork.chainId})`);
  console.log(`treasury: ${treasuryAddressFor(ANCHOR_NETWORK)}`);
  console.log(`anchor: ${anchorHash}`);
  console.log(
    `derived: ${anchor.principal} ${anchor.asset} from ${anchor.sender} to ${anchor.recipient} ` +
      `+ ${anchor.treasuryFee} fee\n`
  );
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
    network: ANCHOR_NETWORK,
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
  //   * `signerWallet` — DEPRECATED, holding the RECEIPT's sender: the address
  //                      the chain recorded as the sender of the anchor.
  //                      Deprecated is what login does to a row when it
  //                      registers a different address, which is exactly how a
  //                      real account ends up in this shape — and why a lookup by
  //                      status can never find the signer.
  //
  // The row must land on `signerWallet`. Making the wrong wallet the ACTIVE one
  // (rather than relying on row order) is what keeps this deterministic.
  //
  // `SELF_ADDRESS` is a real, valid address (the self-send refusal runs through
  // EIP-55 validation first, so a placeholder string would be refused for the
  // wrong reason). Nothing signs with it.
  //
  // The two wallets' asset labels are deliberately unreliable as filters: the
  // account's ACTIVE wallet is labelled with the asset the suite sends while the
  // row that actually SIGNED is labelled `pathusd` and is DEPRECATED. A lookup by
  // (asset, status) therefore finds the wrong wallet — which is the bug the
  // binding assertion below exists to catch. Do not "tidy" the labels into
  // agreement: login labels every wallet with the primary asset, and the signer's
  // row can carry any label.
  //
  // The ACTIVE row's label follows the receipt's asset (`anchor.asset`), which is
  // `ousd` on the practice anchor: the point is that it agrees with what the suite
  // sends while still being the WRONG wallet.
  const otherWallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      chain: 'tempo',
      asset: anchor.asset,
      address: SELF_ADDRESS,
      status: 'active',
      // Registered on the network this suite records on: a wallet the account does
      // not hold where it is sending is refused as `signer-not-owned`, which would
      // make every assertion below a refusal for the wrong reason.
      network: ANCHOR_NETWORK,
    },
  });

  // The addresses the fixture must OWN have to be FREE on this network, and a
  // collision is a real signal rather than an obstacle: `wallets` is unique on
  // (address, network), so an address another account holds cannot be declared
  // here. Both the signer and the recipient are checked, and each fails LOUDLY
  // naming the address — never a P2002 that reads like a broken suite, and never
  // a quiet skip (the binding is the whole point of these assertions).
  await assertAddressIsFree(anchor.sender, 'sender');
  await assertAddressIsFree(anchor.recipient, 'recipient');

  const signerWallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      chain: 'tempo',
      asset: 'pathusd',
      address: anchor.sender,
      status: 'deprecated',
      network: ANCHOR_NETWORK,
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
      address: anchor.recipient,
      network: ANCHOR_NETWORK,
    },
  });

  const countRows = () => prisma.transaction.count({ where: { userId: user.id } });

  // --- Guards that do not need a real receipt -------------------------------

  // FEE_ROUTING_MODE must be batch for the rest of this suite to mean anything,
  // so the declaration is supplied on every call. The declared address is a
  // real, DECLARED wallet of the account's — the signer's row.
  const signed = signerWallet.address;

  let threw = false;
  let message = '';
  try {
    await recordOnAnchorNetwork({
      userId: user.id,
      amount: '1',
      asset: anchor.asset,
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
    await recordOnAnchorNetwork({
      userId: user.id,
      amount: '1',
      asset: anchor.asset,
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
    recordOnAnchorNetwork({
      userId: user.id,
      amount: anchor.principal,
      asset: anchor.asset,
      recipient: anchor.recipient,
      txHash: anchorHash,
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
    recordOnAnchorNetwork({
      userId: user.id,
      amount: anchor.principal,
      asset: anchor.asset,
      recipient: anchor.recipient,
      txHash: anchorHash,
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
    recordOnAnchorNetwork({
      userId: user.id,
      amount: anchor.principal,
      asset: anchor.asset,
      recipient: anchor.recipient,
      txHash: anchorHash,
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
    recordOnAnchorNetwork({
      userId: user.id,
      amount: anchor.principal,
      asset: anchor.asset,
      recipient: anchor.recipient,
      txHash: anchorHash,
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
    notTheSender.message.includes(anchor.sender) &&
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
        txHash: anchorHash,
        metadata: { path: ['code'], equals: 'signer-mismatch' },
      },
    })) === 1
  );

  // --- "Recipient paid, treasury not" — the missing fee leg ----------------
  console.log('\nrecipient leg present, fee leg missing:');

  const plainTx = await findRecentTransfer();
  const plainTransfer = plainTx ? await describeTransfer(plainTx as Hex) : null;

  if (!plainTx || !plainTransfer) {
    console.log('skip  no recent OUSD transfer found; cannot exercise the fee-leg guard.');
  } else {
    console.log(`  anchoring on plain transfer: ${plainTx}`);
    console.log(`  recipient ${plainTransfer.to}, moved ${plainTransfer.value}\n`);

    threw = false;
    message = '';
    try {
      await recordOnAnchorNetwork({
        userId: user.id,
        amount: plainTransfer.value,
        asset: anchor.asset,
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
        message
          .toLowerCase()
          .includes(treasuryAddressFor(ANCHOR_NETWORK).slice(0, 10).toLowerCase()),
      message.slice(0, 78)
    );
    check('no row written when the fee leg is missing', (await countRows()) === 0);

    // The same receipt with a materially different claim must be refused for the
    // amount, before the fee leg is even considered.
    threw = false;
    message = '';
    const wrongAmount = (Number(plainTransfer.value) * 3).toFixed(8);
    try {
      await recordOnAnchorNetwork({
        userId: user.id,
        amount: wrongAmount,
        asset: anchor.asset,
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
    // fixture declared, and it is NOT the account's active wallet. The fixture's
    // declaration IS `receipt.from` (derived), so a mismatch here would mean the
    // derivation and the receipt disagree — it fails loudly rather than turning
    // into a confusing binding assertion.
    check(
      'the anchor receipt was signed by the declared wallet',
      anchorReceipt?.from?.toLowerCase() === signerWallet.address.toLowerCase(),
      `receipt.from ${anchorReceipt?.from} vs declared ${signerWallet.address}`
    );

    const transaction = await recordOnAnchorNetwork({
      userId: user.id,
      amount: anchor.principal,
      asset: anchor.asset,
      recipient: anchor.recipient,
      txHash: anchorHash,
      quoteId: sendQuoteId,
      walletAddress: signerWallet.address,
    });

    check('a two-leg send is recorded, not refused', Boolean(transaction.id));
    check('it is written as a p2p_send', transaction.type === 'p2p_send');
    check(
      'and it carries the hash that was verified',
      transaction.txHash === anchorHash
    );
    check(
      'the counterparty is the recipient the chain paid',
      transaction.counterparty?.toLowerCase() === anchor.recipient.toLowerCase()
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
    const expectedPrincipalKes = Number(anchor.principal) * quote.fiatPerUsd;
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
      receivedRows[0]?.amount?.toNumber() === Number(anchor.principal)
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
      recipient: getAddress(anchor.recipient),
      amountAsset: Number(anchor.principal),
      amountFiat: Number(anchor.principal) * quote.fiatPerUsd,
      asset: anchor.asset,
      txHash: anchorHash,
      senderAddress: signerWallet.address,
      network: ANCHOR_NETWORK,
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
    const gasPriceUsed = anchorReceipt.effectiveGasPrice ?? (await anchorPublicClient.getGasPrice());
    const computedUnits = (anchorReceipt.gasUsed * gasPriceUsed) / scale;

    const token = getTokenContract(anchor.asset, ANCHOR_NETWORK).toLowerCase();
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

      const live = await estimateNetworkFee(anchor.asset);
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
