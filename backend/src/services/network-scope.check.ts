/**
 * NETWORK SCOPING — practice ⇄ live, proved end to end.
 *
 * Run with:  npm run check:network
 * Requires:  the `seti-postgres` container (docker compose up -d)
 *
 * One account practises on testnet and goes live on mainnet. Seven claims have to
 * be true at once, and each one is made a refusal or a value rather than a
 * promise:
 *
 *   (a) a name claimed while PRACTISING does not block that same name being
 *       claimed on LIVE (and a second claim of it on the SAME network still is
 *       refused);
 *   (b) a practice-signed price quote is REFUSED on live, and a live one is
 *       refused on practice — the money hazard, pinned;
 *   (c) the two indexer cursors advance INDEPENDENTLY;
 *   (d) the same user has DIFFERENT addresses per network, and Activity never
 *       mixes the two;
 *   (e) Live is REFUSED with a stated reason while the deployment is not
 *       mainnet-ready, and the account's own names get FIRST REFUSAL on the live
 *       network so a practice claim is not stealable in the gap;
 *   (f) the six existing merchants and every existing handle still resolve and
 *       still verify on testnet EXACTLY as before.
 *
 * Plus the session rule: a client-supplied chain id is REFUSED.
 *
 * IMPORTANT: every row this file touches belongs to fixture users
 * (`check-netscope-*@seti.test`) or to fixture handles prefixed `NetScope`. The
 * cursor assertions SNAPSHOT and RESTORE the two real network cursors, so a run
 * never resets live indexing progress.
 */
import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { prisma } from '../lib/prisma.js';
import { getActiveWallet, registerWallet } from './wallet-registry.js';
import { transactionRoutes } from '../routes/transactions.js';
import { networkScopeHook } from '../middleware/network-scope.js';
import {
  claimHandle,
  grantFirstRefusal,
  HANDLE_CLAIM_PRIMARY_TYPE,
  HANDLE_CLAIM_TYPES,
  handleClaimDomain,
  handleClaimVerifies,
  merchantHandle,
  PURPOSE_FOR_KIND,
  toHandleIdentityView,
  type HandleClaimMessage,
  type HandleKind,
} from './handle-claims.js';
import { issueQuote, readQuote, QuoteError } from './quote.js';
import {
  anchorFor,
  evaluateMainnetReadiness,
  isUsableTreasury,
  mainnetReadiness,
  network,
  networkConfigFor,
  pickRpcUrl,
  servedNetwork,
  treasuryAddressFor,
} from '../config/networks.js';
import { cursorKeyFor, NETWORK_CHAIN_NAME, NETWORKS, NETWORK_LABEL, chainIdForNetwork, normalizeNetwork, TEMPO_MAINNET_CHAIN_ID, TEMPO_TESTNET_CHAIN_ID } from '../lib/network.js';
import { findHandleByHandle } from './handles.js';
import { getAccountIdentity, setAccountNetwork } from './account.js';
import {
  advanceCursor,
  readCursor,
  releaseLock,
  tryAcquireLock,
} from './indexer-store.js';

const FIXTURE_EMAIL_A = 'check-netscope-a@seti.test';
const FIXTURE_EMAIL_B = 'check-netscope-b@seti.test';
const FIXTURE_EMAILS = [FIXTURE_EMAIL_A, FIXTURE_EMAIL_B];

/** Fixture names. Prefixed so cleanup can find every row this file wrote. */
const NAME_PRACTICE_LIVE = 'NetScope Alpha';
const NAME_REFUSAL = 'NetScope Refusal';
const NAME_CONTROL = 'NetScope Control';
/** The business name the FIRST-REFUSAL hold is exercised on (a name of its own,
 * because `NAME_CONTROL` is already taken on practice by section (a)). */
const NAME_HOLD_LIVE = 'NetScope Hold';
const FIXTURE_NAME_PREFIX = 'NetScope';

const HANDLE_WHERE = {
  OR: [
    { handle: { startsWith: 'netscope', mode: 'insensitive' as const } },
    { name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const } },
  ],
};
const MERCHANT_WHERE = { name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const } };

/** The six merchants, as they resolved before network scoping — pinned here. */
const MERCHANTS = [
  { handle: 'ianllc', address: '0xE2eF55fD97f1e666782D1F653d29fcE88D585e28', verified: true },
  { handle: 'burgerking', address: '0x3Ee67d07F52C0bf9DeDaF495B17C72b47B35631a', verified: true },
  { handle: 'kfc', address: '0x3Ee67d07F52C0bf9DeDaF495B17C72b47B35631a', verified: true },
  { handle: 'seti', address: '0x02b02edc794548897CD50D9fb55539197efCA1Ac', verified: true },
  { handle: 'javahouse', address: '0x20C000000000000000000000b9537d11c60E8b50', verified: false },
  { handle: 'safaricomshop', address: '0x20c0000000000000000000009e8d7eb59b783726', verified: false },
];

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(66)} ${String(actual)}${ok ? '' : ` (expected ${String(expected)})`}`
  );
}

function nonce(): string {
  return randomBytes(16).toString('hex');
}

async function sign(account: PrivateKeyAccount, message: HandleClaimMessage, target: 'testnet' | 'mainnet') {
  return account.signTypedData({
    domain: handleClaimDomain(target),
    types: HANDLE_CLAIM_TYPES,
    primaryType: HANDLE_CLAIM_PRIMARY_TYPE,
    message: { ...message },
  });
}

/** Claim a handle on a NETWORK with a fresh signature, returning the refusal code or 'claimed'. */
async function claim(
  userId: string,
  account: PrivateKeyAccount,
  kind: HandleKind,
  name: string,
  target: 'testnet' | 'mainnet',
  address = account.address
): Promise<string> {
  const message: HandleClaimMessage = {
    name,
    address,
    purpose: PURPOSE_FOR_KIND[kind],
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const signature = await sign(account, message, target);
  try {
    await claimHandle({ userId, kind, ...message, signature, network: target });
    return 'claimed';
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      return String(error.code);
    }
    throw error;
  }
}

function quoteCode(token: string, userId: string, target: 'testnet' | 'mainnet'): string {
  try {
    readQuote(token, userId, target);
    return 'accepted';
  } catch (error) {
    if (error instanceof QuoteError) return error.code;
    throw error;
  }
}

async function cleanup() {
  await prisma.handle.deleteMany({ where: HANDLE_WHERE });
  await prisma.merchant.deleteMany({ where: MERCHANT_WHERE });

  const users = await prisma.user.findMany({
    where: { email: { in: FIXTURE_EMAILS } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.transaction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function main() {
  await cleanup();

  const practiceOwner = privateKeyToAccount(generatePrivateKey());
  const liveOwner = privateKeyToAccount(generatePrivateKey());
  const rival = privateKeyToAccount(generatePrivateKey());

  const userA = await prisma.user.create({ data: { email: FIXTURE_EMAIL_A } });
  const userB = await prisma.user.create({ data: { email: FIXTURE_EMAIL_B } });

  // The SAME account, a DIFFERENT address on each network.
  await registerWallet({
    userId: userA.id,
    chain: 'tempo',
    asset: 'ousd',
    address: practiceOwner.address,
    network: 'testnet',
  });
  await registerWallet({
    userId: userA.id,
    chain: 'tempo',
    asset: 'ousd',
    address: liveOwner.address,
    network: 'mainnet',
  });
  await registerWallet({
    userId: userB.id,
    chain: 'tempo',
    asset: 'ousd',
    address: rival.address,
    network: 'testnet',
  });
  await registerWallet({
    userId: userB.id,
    chain: 'tempo',
    asset: 'ousd',
    address: rival.address,
    network: 'mainnet',
  });

  // ---------------------------------------------------------------------------
  // (f) the served deployment, and the pre-existing rows — unchanged
  // ---------------------------------------------------------------------------
  console.log('(f) the served deployment, and the six existing handles:');
  // NOT "this box serves testnet": which network a deployment serves is a
  // per-deployment fact (`TEMPO_CHAIN_ID` / `DEFAULT_NETWORK`), and this suite must
  // run on either. What is asserted is that the served config is internally
  // consistent — the chain id and the chain name are the SERVED network's own — so
  // a box that claims one network while pointing at another's chain fails here.
  check('the served network is one of the two', NETWORKS.includes(servedNetwork), true);
  check('the served config names the served network', network.name, NETWORK_CHAIN_NAME[servedNetwork] ?? network.name);
  check('the served chain id is the served network’s own', network.chainId, chainIdForNetwork(servedNetwork));

  // Per-network config exists for BOTH networks (not one env value).
  check('mainnet config carries chain 4217', networkConfigFor('mainnet').chainId, TEMPO_MAINNET_CHAIN_ID);
  check('testnet config carries chain 42431', networkConfigFor('testnet').chainId, TEMPO_TESTNET_CHAIN_ID);
  check(
    'the two networks have their own explorer',
    networkConfigFor('mainnet').explorerUrl !== networkConfigFor('testnet').explorerUrl,
    true
  );
  check('testnet anchors are pinned per network', typeof anchorFor('testnet', 'payout'), 'string');

  // The pre-existing rows are PRACTICE rows (they predate the network dimension
  // and were backfilled to `testnet`). Business handles are per network, so the
  // network-scoped resolver is asked for the network they are ON — read on the
  // served network a practice merchant is correctly invisible, which is the rule,
  // not a regression. (Whether a practice business name SHOULD resolve on live is a
  // product question the owner has left open; see the `Handle` model.)
  for (const m of MERCHANTS) {
    const row = await findHandleByHandle(m.handle, 'testnet');
    const view = row ? await toHandleIdentityView(row) : null;
    check(`${m.handle}: still resolves on its own network`, Boolean(row), true);
    check(`${m.handle}: address unchanged`, view?.address, m.address);
    check(`${m.handle}: verified unchanged`, view?.verified, m.verified);
    check(`${m.handle}: is bound to testnet`, view?.network, 'testnet');
  }

  // ---------------------------------------------------------------------------
  // (a) a practice claim does not block a live claim of the same name
  // ---------------------------------------------------------------------------
  console.log('\n(a) a practice claim does not block the same name on live:');
  check(
    'user A claims the name while PRACTISING',
    await claim(userA.id, practiceOwner, 'business', NAME_PRACTICE_LIVE, 'testnet'),
    'claimed'
  );
  check(
    'a DIFFERENT account claims the SAME name on LIVE',
    await claim(userB.id, rival, 'business', NAME_PRACTICE_LIVE, 'mainnet'),
    'claimed'
  );

  const practiceRow = await prisma.handle.findFirst({
    where: { handle: merchantHandle(NAME_PRACTICE_LIVE), network: 'testnet' },
  });
  const liveRow = await prisma.handle.findFirst({
    where: { handle: merchantHandle(NAME_PRACTICE_LIVE), network: 'mainnet' },
  });
  check('two rows exist for the one name', Boolean(practiceRow) && Boolean(liveRow), true);
  check('the practice row is the practice address', practiceRow?.address, practiceOwner.address);
  check('the live row is the live address', liveRow?.address, rival.address);

  // The control: on the SAME network, a second claimer is still refused.
  check(
    'a control name is claimed on practice',
    await claim(userB.id, rival, 'business', NAME_CONTROL, 'testnet'),
    'claimed'
  );
  check(
    'a second claim of that name on the SAME network is refused',
    await claim(userA.id, practiceOwner, 'business', NAME_CONTROL, 'testnet'),
    'handle-taken'
  );

  // ---------------------------------------------------------------------------
  // (b) a quote is network-scoped — the money hazard
  // ---------------------------------------------------------------------------
  console.log('\n(b) a practice-signed quote is refused on live, and vice versa:');
  const practiceQuote = issueQuote({
    userId: userA.id,
    network: 'testnet',
    fiatCurrency: 'KES',
    fiatPerUsd: 129.5,
    source: 'check',
    asOf: new Date(),
  });
  check('a practice quote is accepted on practice', quoteCode(practiceQuote, userA.id, 'testnet'), 'accepted');
  check('a practice quote is REFUSED on live', quoteCode(practiceQuote, userA.id, 'mainnet'), 'quote-wrong-network');

  const liveQuote = issueQuote({
    userId: userA.id,
    network: 'mainnet',
    fiatCurrency: 'KES',
    fiatPerUsd: 129.5,
    source: 'check',
    asOf: new Date(),
  });
  check('a live quote is accepted on live', quoteCode(liveQuote, userA.id, 'mainnet'), 'accepted');
  check('a live quote is REFUSED on practice', quoteCode(liveQuote, userA.id, 'testnet'), 'quote-wrong-network');

  // ---------------------------------------------------------------------------
  // (c) the two indexer cursors advance independently
  // ---------------------------------------------------------------------------
  console.log('\n(c) the two indexer cursors advance independently:');
  const testnetKey = cursorKeyFor('testnet');
  const mainnetKey = cursorKeyFor('mainnet');

  // SNAPSHOT the real cursors so the run never resets indexing progress.
  const testnetBefore = await readCursor(testnetKey);
  const mainnetBefore = await readCursor(mainnetKey);

  const t0 = 100_000n + BigInt(Date.now() % 1000);
  const m0 = 900_000n + BigInt(Date.now() % 1000);

  // Retry, because a RUNNING indexer holds the lock on every tick.
  //
  // The lock is a 60s-TTL compare-and-set that a live replica takes and releases
  // around each scan, so a suite that demands it instantly is racing whichever
  // indexer happens to be mid-scan — and a lost lock makes `advanceCursor` a no-op
  // that silently leaves the OTHER replica's block number in place, which reads as
  // "the cursors are not independent" while proving nothing. Waiting makes this
  // assertion about the code (two cursors that advance independently) rather than
  // about the timing of a process this suite does not own.
  async function lockOrWait(chain: string, replicaId: string): Promise<boolean> {
    const deadline = Date.now() + 20_000;
    let waited = false;
    while (Date.now() < deadline) {
      if (await tryAcquireLock(chain, replicaId)) {
        if (waited) console.log(`      (waited for the ${chain} cursor lock — a live indexer was mid-scan)`);
        return true;
      }
      waited = true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  }

  const lockedTestnet = await lockOrWait(testnetKey, 'check-ns-t');
  check('a replica can lock the testnet cursor', lockedTestnet, true);
  check('and the advance landed', await advanceCursor(testnetKey, t0, 'check-ns-t'), true);

  const lockedMainnet = await lockOrWait(mainnetKey, 'check-ns-m');
  check('a replica can lock the mainnet cursor', lockedMainnet, true);
  check('and the advance landed', await advanceCursor(mainnetKey, m0, 'check-ns-m'), true);

  check('the testnet cursor advanced to its own block', (await readCursor(testnetKey)).lastBlock, t0);
  check('the mainnet cursor advanced to its own block', (await readCursor(mainnetKey)).lastBlock, m0);

  const t1 = t0 + 500n;
  check('the second testnet lock is taken', await lockOrWait(testnetKey, 'check-ns-t2'), true);
  check('and its advance landed', await advanceCursor(testnetKey, t1, 'check-ns-t2'), true);
  check('advancing testnet leaves mainnet untouched', (await readCursor(mainnetKey)).lastBlock, m0);
  check('and testnet moved on', (await readCursor(testnetKey)).lastBlock, t1);

  // RESTORE the real cursors.
  check('the testnet cursor is locked for the restore', await lockOrWait(testnetKey, 'check-ns-restore-t'), true);
  await advanceCursor(testnetKey, testnetBefore.lastBlock, 'check-ns-restore-t');
  await releaseLock(testnetKey, 'check-ns-restore-t');
  check('the mainnet cursor is locked for the restore', await lockOrWait(mainnetKey, 'check-ns-restore-m'), true);
  await advanceCursor(mainnetKey, mainnetBefore.lastBlock, 'check-ns-restore-m');
  await releaseLock(mainnetKey, 'check-ns-restore-m');
  check('the testnet cursor is restored', (await readCursor(testnetKey)).lastBlock, testnetBefore.lastBlock);
  check('the mainnet cursor is restored', (await readCursor(mainnetKey)).lastBlock, mainnetBefore.lastBlock);

  // ---------------------------------------------------------------------------
  // (d) different addresses per network; Activity never mixes the two
  // ---------------------------------------------------------------------------
  console.log('\n(d) one user, two addresses, and Activity that never mixes:');
  const practiceWallet = await getActiveWallet(userA.id, 'testnet');
  const liveWallet = await getActiveWallet(userA.id, 'mainnet');
  check('the practice address is the practice one', practiceWallet?.address, practiceOwner.address);
  check('the live address is the live one', liveWallet?.address, liveOwner.address);
  check('the two addresses are DIFFERENT', practiceWallet?.address !== liveWallet?.address, true);
  check('registering the live address did not deprecate the practice wallet', practiceWallet?.status, 'active');
  check(
    'the account has one ACTIVE wallet per network',
    await prisma.wallet.count({ where: { userId: userA.id, status: 'active' } }),
    2
  );

  // A practice row and a live row for the same user, and the same hash on both
  // chains (allowed: txHash is unique per network).
  const sharedHash = `0x${'ab'.repeat(32)}`;
  await prisma.transaction.create({
    data: {
      userId: userA.id,
      walletId: practiceWallet!.id,
      network: 'testnet',
      type: 'top_up',
      status: 'completed',
      amount: '100.00000000',
      asset: 'ousd',
      txHash: sharedHash,
    },
  });
  await prisma.transaction.create({
    data: {
      userId: userA.id,
      walletId: liveWallet!.id,
      network: 'mainnet',
      type: 'top_up',
      status: 'completed',
      amount: '250.00000000',
      asset: 'ousd',
      txHash: sharedHash,
    },
  });

  check(
    'each network has exactly one row for the shared hash',
    await prisma.transaction.count({ where: { userId: userA.id, txHash: sharedHash } }),
    2
  );
  check(
    'the practice read sees only the practice row',
    await prisma.transaction.count({ where: { userId: userA.id, network: 'testnet' } }),
    1
  );
  check(
    'the live read sees only the live row',
    await prisma.transaction.count({ where: { userId: userA.id, network: 'mainnet' } }),
    1
  );
  check(
    'the amounts never cross',
    (await prisma.transaction.findFirst({ where: { userId: userA.id, network: 'testnet' } }))?.amount.toString(),
    '100'
  );
  check(
    'and the live figure is its own',
    (await prisma.transaction.findFirst({ where: { userId: userA.id, network: 'mainnet' } }))?.amount.toString(),
    '250'
  );

  // ---------------------------------------------------------------------------
  // The session rule: a client-supplied chain id is REFUSED
  // ---------------------------------------------------------------------------
  console.log('\nthe session network is the server\'s: a client-supplied chain id is refused:');
  const app = Fastify();
  app.addHook('preHandler', networkScopeHook);
  await app.register(transactionRoutes, { prefix: '/transactions' });
  await app.ready();

  const withChainId = await app.inject({
    method: 'GET',
    url: `/transactions?chainId=${TEMPO_MAINNET_CHAIN_ID}`,
  });
  check('a request carrying chainId is refused', withChainId.statusCode, 400);
  check(
    'and the refusal is the typed client-network-refused',
    withChainId.json<Record<string, unknown>>().code,
    'client-network-refused'
  );

  const withHeader = await app.inject({
    method: 'GET',
    url: '/transactions',
    headers: { 'x-tempo-chain-id': String(TEMPO_MAINNET_CHAIN_ID) },
  });
  check('a chain id in a header is refused too', withHeader.statusCode, 400);

  const plain = await app.inject({ method: 'GET', url: '/transactions' });
  check('the same route works without one', plain.statusCode, 200);

  // The Activity route itself is network-scoped: it serves the caller's network
  // and nothing else. The caller is the dev-bypass user, whose network is the one
  // this process SERVES (`attachDevTestUser` writes it every request), so the
  // fixture row and the assertion both name the SERVED network rather than a
  // hardcoded practice one.
  //
  // The fixture's `walletId` is one of the DEV USER'S OWN rows. Borrowing another
  // fixture's wallet (the old `?? practiceWallet!.id` fallback) wrote a row that
  // this suite's cleanup could not see — it deletes transactions and wallets by the
  // FIXTURE users' ids — so the wallet delete then failed on the foreign key. A
  // fixture must never point one account's row at another account's wallet.
  const devUser = await prisma.user.findUnique({ where: { email: 'dev@seti.test' } });
  const devWallet = devUser ? await prisma.wallet.findFirst({ where: { userId: devUser.id } }) : null;

  if (devUser && devWallet) {
    const devNetwork = normalizeNetwork(devUser.network, servedNetwork);
    await prisma.transaction.createMany({
      data: [
        {
          userId: devUser.id,
          walletId: devWallet.id,
          network: devNetwork,
          type: 'top_up',
          status: 'completed',
          amount: '1.00000000',
          asset: 'ousd',
        },
      ],
      skipDuplicates: true,
    });
    const visible = await app.inject({ method: 'GET', url: '/transactions' });
    const rows = visible.json<{ transactions: Array<{ id: string }> }>().transactions;
    const networks = await prisma.transaction.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: { network: true },
    });
    check('the Activity route returns rows', rows.length > 0, true);
    check(
      'and every one of them is on the session network',
      networks.every((r) => r.network === devNetwork),
      true
    );
  } else {
    console.log('  (skipped the Activity-scope read: no dev bypass user, or no wallet row to attach the fixture to)');
  }
  await app.close();

  // ---------------------------------------------------------------------------
  // (e) the switch, FIRST REFUSAL on business names, and the GLOBAL username
  // ---------------------------------------------------------------------------
  console.log('\n(e) the switch to Live, first refusal on business names, and the global username:');
  // The gate's REFUSAL is pinned through its pure evaluator in section (h), because
  // a correctly-configured box cannot reach it. What this deployment's own verdict
  // must be is decided by what it SERVES: a mainnet box with the opt-in, the
  // treasury and the proof opens Live, and a practice box refuses it with a reason.
  const readiness = mainnetReadiness();
  check('the readiness verdict follows what this deployment serves', readiness.ready, servedNetwork === 'mainnet');
  if (!readiness.ready) console.log(`      reason: ${readiness.reason}`);

  const moved = await setAccountNetwork(userA.id, 'mainnet');
  if (readiness.ready) {
    // This box serves Live and every precondition holds: the switch is accepted.
    check('the switch to Live is accepted on this deployment', moved.ok, true);
    check(
      'and the account is acting on the network it switched to',
      normalizeStoredNetwork(await storedNetwork(userA.id)),
      'mainnet'
    );
    check('and the account read follows the switch', moved.ok ? moved.identity.network : 'refused', 'mainnet');
  } else {
    // This box serves Practice, so Live is refused with the reason the gate
    // states — the typed `mainnet-not-ready` the UI branches on. The gate's own
    // conditions are pinned in (h); what matters HERE is that the refusal leaves
    // the account on the network it was already acting on.
    check('the switch to Live is refused on a practice deployment', moved.ok, false);
    check('with the typed code', moved.ok ? 'ok' : moved.code, 'mainnet-not-ready');
    check(
      'and the account did NOT move networks',
      normalizeStoredNetwork(await storedNetwork(userA.id)),
      'testnet'
    );
  }

  // FIRST REFUSAL, for a BUSINESS name: the account claims it while practising,
  // then the switch holds the string on live so the gap between the practice claim
  // and the live one is closed.
  check(
    'the account claims a practice BUSINESS name',
    await claim(userA.id, practiceOwner, 'business', NAME_HOLD_LIVE, 'testnet'),
    'claimed'
  );
  const reserved = await grantFirstRefusal(userA.id, 'mainnet');
  check("first refusal holds the account's practice business name", reserved >= 1, true);

  const hold = await prisma.handle.findFirst({
    where: { handle: merchantHandle(NAME_HOLD_LIVE), network: 'mainnet' },
  });
  check('the business name is held on live for the account', hold?.reviewStatus, 'reserved');
  check('the hold belongs to the account', hold?.userId, userA.id);
  check('a hold does not resolve as a live name', await findHandleByHandle(merchantHandle(NAME_HOLD_LIVE), 'mainnet'), null);

  check(
    'ANOTHER account cannot take the held business name on live',
    await claim(userB.id, rival, 'business', NAME_HOLD_LIVE, 'mainnet'),
    'handle-taken'
  );
  check(
    'the holding account can, with a fresh live signature',
    await claim(userA.id, liveOwner, 'business', NAME_HOLD_LIVE, 'mainnet'),
    'claimed'
  );

  const reclaimed = await prisma.handle.findFirst({
    where: { handle: merchantHandle(NAME_HOLD_LIVE), network: 'mainnet' },
  });
  check('the re-claim went LIVE (no longer reserved)', reclaimed?.reviewStatus, null);
  check('and it verifies', await handleClaimVerifies(reclaimed!), true);

  // ---------------------------------------------------------------------------
  // A PERSON's username is GLOBAL: one name, one account, both networks.
  //
  // No hold and no second row — the name claimed while PRACTISING is already in
  // force on Live, nobody else can take it on either network, and the account read
  // on Live still shows it. This is the impersonation hole the per-network rule
  // left open, and the "switch and keep your name" behaviour the owner asked for.
  // ---------------------------------------------------------------------------
  console.log('\nthe username is global:');
  check(
    'the account claims a username while PRACTISING',
    await claim(userA.id, practiceOwner, 'person', NAME_REFUSAL, 'testnet'),
    'claimed'
  );
  const personRow = await prisma.handle.findFirst({ where: { handle: merchantHandle(NAME_REFUSAL) } });
  check('the username is ONE row, bound to Practice', personRow?.network, 'testnet');

  const livePersonRow = await findHandleByHandle(merchantHandle(NAME_REFUSAL), 'mainnet');
  check('and it resolves on LIVE with no re-claim at all', Boolean(livePersonRow), true);
  check('and it verifies there', livePersonRow ? await handleClaimVerifies(livePersonRow) : false, true);
  check('and it shows the address it was claimed for', livePersonRow?.address, practiceOwner.address);

  check(
    'a DIFFERENT account cannot claim it on live',
    await claim(userB.id, rival, 'person', NAME_REFUSAL, 'mainnet'),
    'handle-taken'
  );
  check(
    'nor on practice',
    await claim(userB.id, rival, 'person', NAME_REFUSAL, 'testnet'),
    'handle-taken'
  );
  check(
    'and there is still exactly one row for it',
    await prisma.handle.count({ where: { handle: merchantHandle(NAME_REFUSAL) } }),
    1
  );

  const liveIdentity = await getAccountIdentity(userA.id);
  // The account acts on the network this deployment SERVES: Live when the switch
  // above was accepted, Practice when it was refused. The GLOBAL-username property
  // asserted here does not depend on which — that is the whole point of a username
  // being global — so this asserts the read agrees with what the box serves.
  check('the account read shows the network this deployment serves', liveIdentity.network, servedNetwork);
  check(
    'and lists it among the names the account holds',
    liveIdentity.handles.some((h) => h.handle === merchantHandle(NAME_REFUSAL)),
    true
  );
  check('so onboarding is not re-triggered by the switch', liveIdentity.onboarded, true);

  console.log(`\nnetworks: ${NETWORK_LABEL.testnet} = ${cursorKeyFor('testnet')}, ${NETWORK_LABEL.mainnet} = ${cursorKeyFor('mainnet')}`);
  console.log(`treasury(practice) = ${treasuryAddressFor('testnet')}`);

  // ---------------------------------------------------------------------------
  // (g) per-network config, and the legacy single-network RPC vars never leak
  // ---------------------------------------------------------------------------
  // The legacy `TEMPO_CHAIN_ID` / `TEMPO_RPC_URL` name ONE chain. When they name
  // the TESTNET (as this deployment's `.env` does), a mainnet config must NOT
  // inherit that endpoint — it reads and signs against the wrong chain if it
  // does. Printed for BOTH networks so the whole resolved config is visible.
  console.log('\n(g) both networks resolved, with the legacy TEMPO_* vars set to testnet values:');
  for (const name of ['testnet', 'mainnet'] as const) {
    const cfg = networkConfigFor(name);
    console.log(
      `      ${name}:\n` +
        `        chainId   = ${cfg.chainId}\n` +
        `        rpcUrl    = ${cfg.rpcUrl}\n` +
        `        treasury  = ${cfg.treasuryAddress}\n` +
        `        pathUSD   = ${cfg.tokens.pathusd}\n` +
        `        OUSD      = ${cfg.tokens.ousd}`
    );
  }

  const testnetCfg = networkConfigFor('testnet');
  const mainnetCfg = networkConfigFor('mainnet');

  check('the two networks carry their OWN chain id', mainnetCfg.chainId !== testnetCfg.chainId, true);
  check('the two networks do NOT share an RPC endpoint', mainnetCfg.rpcUrl !== testnetCfg.rpcUrl, true);
  check('the testnet RPC does not point at mainnet', /mainnet/.test(testnetCfg.rpcUrl), false);

  // A box may point a network at any endpoint it likes, so this is REPORTED, not
  // asserted. What the code guarantees — that the legacy single-network
  // (`TEMPO_CHAIN_ID` / `TEMPO_RPC_URL`) pair never reaches across chains — is
  // pinned by the pure `pickRpcUrl` assertions below, which are env-independent.
  // This box's OWN resolution is named out loud because a mainnet config that
  // resolves to the practice endpoint means live reads, live receipts and live
  // signing would all hit the practice chain — a deployment fault, not a code fault,
  // and one an operator has to see rather than have hidden behind a green tick.
  const mainnetPointsAtPractice = /moderato|testnet/.test(mainnetCfg.rpcUrl);
  console.log(
    mainnetPointsAtPractice
      ? `WARN  the mainnet config resolves to the PRACTICE endpoint (${mainnetCfg.rpcUrl}).\n` +
        '      Live reads and live settlement would go to the practice chain. Fix it with\n' +
        '      TEMPO_MAINNET_RPC_URL (or by pointing the legacy TEMPO_RPC_URL at mainnet) —\n' +
        '      and check the mainnet indexer cursor first: it currently holds a block number\n' +
        '      from the practice chain, so switching endpoints needs the cursor seeded to the\n' +
        '      mainnet head (see docs/operations.md) or the indexer will walk a wrong range.'
      : 'ok    the mainnet RPC does not point at the testnet (Moderato)'
  );

  // The pure decision, pinned with explicit testnet-valued legacy vars — the
  // exact shape the bug came from, independent of whatever this box's `.env`
  // happens to hold.
  const LEGACY_TESTNET_RPC = 'https://rpc.moderato.tempo.xyz';
  const legacyNamingTestnet = {
    legacyChainId: String(TEMPO_TESTNET_CHAIN_ID),
    legacyRpcUrl: LEGACY_TESTNET_RPC,
  };

  check(
    'legacy vars naming the TESTNET: the testnet config keeps that endpoint',
    pickRpcUrl(TEMPO_TESTNET_CHAIN_ID, { ...legacyNamingTestnet, fallback: 'TESTNET-FALLBACK' }),
    LEGACY_TESTNET_RPC
  );
  check(
    'legacy vars naming the TESTNET: the MAINNET config does NOT inherit it',
    pickRpcUrl(TEMPO_MAINNET_CHAIN_ID, { ...legacyNamingTestnet, fallback: 'MAINNET-FALLBACK' }),
    'MAINNET-FALLBACK'
  );
  check(
    'a per-network override still wins, for its own network only',
    pickRpcUrl(TEMPO_MAINNET_CHAIN_ID, {
      ...legacyNamingTestnet,
      perNetwork: 'MAINNET-PER-NETWORK',
      fallback: 'MAINNET-FALLBACK',
    }),
    'MAINNET-PER-NETWORK'
  );
  check(
    'and the reverse: legacy vars naming the MAINNET do not reach the testnet config',
    pickRpcUrl(TEMPO_TESTNET_CHAIN_ID, {
      legacyChainId: String(TEMPO_MAINNET_CHAIN_ID),
      legacyRpcUrl: 'https://rpc.tempo.xyz',
      fallback: 'TESTNET-FALLBACK',
    }),
    'TESTNET-FALLBACK'
  );

  // ---------------------------------------------------------------------------
  // (h) the mainnet readiness gate: every refusal, then the opening
  // ---------------------------------------------------------------------------
  // Live may only open when the deployment SERVES mainnet AND the mainnet
  // treasury is a real address (so the fee can never be sent to a blank or burn
  // address) AND the opt-in is on AND a mainnet batch proof exists. Driven here
  // through the pure evaluator, so even the conditions a correctly-running box
  // cannot reach are pinned.
  console.log('\n(h) Live opens only when every precondition holds:');
  const MAINNET_TREASURY = '0x48cb25f9d82aF721e71437feAfb295da627BA475';
  const READY_INPUT = {
    servesMainnet: true,
    servedDisplayName: 'Tempo Mainnet',
    servedChainId: TEMPO_MAINNET_CHAIN_ID,
    allowMainnet: true,
    mainnetTreasury: MAINNET_TREASURY,
    mainnetProofTx: '0xproof',
  } as const;

  const servesTestnet = evaluateMainnetReadiness({
    ...READY_INPUT,
    servesMainnet: false,
    servedDisplayName: 'Tempo Testnet (Moderato)',
    servedChainId: TEMPO_TESTNET_CHAIN_ID,
  });
  check('a deployment serving TESTNET refuses Live', servesTestnet.ready, false);
  check('and the reason names the served network', /Tempo Testnet/.test(servesTestnet.reason ?? ''), true);

  const noOptIn = evaluateMainnetReadiness({ ...READY_INPUT, allowMainnet: false });
  check('mainnet without ALLOW_MAINNET refuses Live', noOptIn.ready, false);
  check('and the reason names ALLOW_MAINNET', (noOptIn.reason ?? '').includes('ALLOW_MAINNET'), true);

  const zeroTreasury = evaluateMainnetReadiness({
    ...READY_INPUT,
    mainnetTreasury: `0x${'0'.repeat(40)}`,
  });
  check('mainnet with the ZERO treasury refuses Live', zeroTreasury.ready, false);
  check('and the reason names the treasury', /treasury/i.test(zeroTreasury.reason ?? ''), true);

  const blankTreasury = evaluateMainnetReadiness({ ...READY_INPUT, mainnetTreasury: undefined });
  check('mainnet with a MISSING treasury refuses Live', blankTreasury.ready, false);

  const malformedTreasury = evaluateMainnetReadiness({ ...READY_INPUT, mainnetTreasury: '0x1234' });
  check('mainnet with a MALFORMED treasury refuses Live', malformedTreasury.ready, false);

  check('the treasury predicate refuses a blank address', isUsableTreasury(undefined), false);
  check('the treasury predicate refuses a malformed address', isUsableTreasury('0x1234'), false);
  check(
    'the treasury predicate refuses the zero (burn) address',
    isUsableTreasury(`0x${'0'.repeat(40)}`),
    false
  );
  check('the treasury predicate accepts a real address', isUsableTreasury(MAINNET_TREASURY), true);

  const noProof = evaluateMainnetReadiness({ ...READY_INPUT, mainnetProofTx: undefined });
  check('mainnet without a batch proof refuses Live', noProof.ready, false);
  check('and the reason names the proof', /batch proof/.test(noProof.reason ?? ''), true);

  const everyConditionMet = evaluateMainnetReadiness(READY_INPUT);
  check('with every condition met, Live opens', everyConditionMet.ready, true);
  check('and there is no reason left to show', everyConditionMet.reason, null);

  // This box's OWN verdict, which depends on what it serves: a deployment that
  // serves Practice refuses Live and says which network it serves; one that serves
  // mainnet opens it (given the opt-in, the treasury and the proof all hold).
  const liveGate = mainnetReadiness();
  if (servedNetwork === 'mainnet') {
    check('a deployment that serves mainnet opens Live', liveGate.ready, true);
    check('and has no reason left to show', liveGate.reason, null);
  } else {
    check('a deployment that serves Practice refuses Live', liveGate.ready, false);
    check('and its reason names the network it serves', /serves/.test(liveGate.reason ?? ''), true);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  await cleanup();
  check('no fixture handle left behind', await prisma.handle.count({ where: HANDLE_WHERE }), 0);
  check('no fixture merchant left behind', await prisma.merchant.count({ where: MERCHANT_WHERE }), 0);

  await prisma.$disconnect();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

async function storedNetwork(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { network: true } });
  return user?.network ?? null;
}

function normalizeStoredNetwork(stored: string | null): string {
  return stored === 'mainnet' ? 'mainnet' : 'testnet';
}

main().catch(async (error) => {
  console.error('network scope check crashed:', error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
