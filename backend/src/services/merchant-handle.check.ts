/**
 * The handle, against live Postgres and REAL EIP-712 signatures.
 *
 * Run with:  npm run check:handle
 * Requires:  the `seti-postgres` container (docker compose up -d)
 *
 * Why real signatures: a handle is only meaningful because the CLAIM that stores
 * it is proved by the address's key. A fixture that inserted a handle directly
 * would test the column, not the claim-time rule this feature exists for. Every
 * claim and refusal below is driven by a throwaway key generated here.
 *
 * What this pins, above all: the handle the BACKEND computes is the handle the
 * WEB's link is built from. They are two implementations of one rule, and the web
 * module is imported here at RUNTIME and compared value-for-value, so a drift
 * fails the gate rather than shipping a link that points somewhere else.
 *
 * The namespace invariant is pinned too: every merchant profile sits behind a
 * unique handle derived from its name, and a person's username and a business's
 * name are shown to compete for the same string.
 *
 * IMPORTANT: every row this file touches belongs to a fixture user
 * (`check-handle-*@seti.test`) or a fixture handle (`Check Handle …`), and every
 * row it ASSERTS about is one it created. It needs no seeded data: a database
 * built from migrations alone is enough, which is what CI has. Real handles are
 * snapshotted and checked unchanged.
 */
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { prisma } from '../lib/prisma.js';
import { registerWallet } from './wallet-registry.js';
import {
  HandleClaimError,
  HANDLE_CLAIM_PRIMARY_TYPE,
  HANDLE_CLAIM_TYPES,
  PURPOSE_FOR_KIND,
  claimHandle,
  handleClaimDomain,
  handleClaimVerifies,
  handleStatus,
  merchantHandle,
  toHandleIdentityView,
  type HandleClaimMessage,
  type HandleKind,
} from './handle-claims.js';
import { findHandleByHandle } from './handles.js';
import { servedNetwork } from './chain.js';
import { handleRoutes } from '../routes/handles.js';
import { publicHandleRoutes } from '../routes/public-handles.js';

/**
 * The web's own handle rule and link builders, imported at RUNTIME.
 *
 * A static `import` would be rejected by `tsc` (web/ is outside this package's
 * rootDir), so the specifier is computed and the module required. This is the
 * whole point: the assertion below is between the LIVE web module and the LIVE
 * backend module, not between the backend and a copy of the table.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webMerchantLink = require(path.resolve(__dirname, '../../../web/lib/merchant-link.ts')) as {
  merchantHandle: (name: string) => string;
  merchantLink: (name: string) => string;
  personLink: (name: string) => string;
};

const FIXTURE_EMAIL_A = 'check-handle-a@seti.test';
const FIXTURE_EMAIL_B = 'check-handle-b@seti.test';

/**
 * The collision pair — two DISTINCT names that reduce to ONE handle.
 *
 * `Mama's Grill` keeps an apostrophe the handle rule drops; `Mamas Grill` never
 * had one. Their names differ (the apostrophe is in the name), so both are
 * claimable strings; their handles are identical. That is the exact ambiguity
 * this feature exists to refuse.
 */
const NAME_FIRST = "Check Handle Mama's Grill";
const NAME_COLLIDING = 'Check Handle Mamas Grill';
const HANDLE_COLLISION = 'checkhandlemamasgrill';

const FIXTURE_NAME_PREFIX = 'Check Handle';
const HANDLE_WHERE = {
  OR: [
    { handle: { startsWith: 'checkhandle', mode: 'insensitive' as const } },
    { name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const } },
  ],
};
const MERCHANT_WHERE = {
  name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const },
};

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(60)} ${String(actual)}${ok ? '' : ` (expected ${String(expected)})`}`
  );
}

function nonce(): string {
  return randomBytes(16).toString('hex');
}

async function signClaim(
  account: PrivateKeyAccount,
  message: HandleClaimMessage
): Promise<`0x${string}`> {
  return account.signTypedData({
    domain: handleClaimDomain(),
    types: HANDLE_CLAIM_TYPES,
    primaryType: HANDLE_CLAIM_PRIMARY_TYPE,
    message: { ...message },
  });
}

async function refusalOf(
  fn: () => Promise<unknown>
): Promise<{ code: string; message: string } | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    if (error instanceof HandleClaimError) return { code: error.code, message: error.message };
    throw error;
  }
}

/** Sign exactly the submitted message, then claim it, reporting any refusal. */
async function attemptClaim(
  userId: string,
  account: PrivateKeyAccount,
  kind: HandleKind,
  name: string,
  address: string
) {
  const message: HandleClaimMessage = {
    name,
    address,
    purpose: PURPOSE_FOR_KIND[kind],
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const signature = await signClaim(account, message);
  return refusalOf(() => claimHandle({ userId, kind, ...message, signature }));
}

async function cleanup() {
  await prisma.handle.deleteMany({ where: HANDLE_WHERE });
  await prisma.merchant.deleteMany({ where: MERCHANT_WHERE });

  const users = await prisma.user.findMany({
    where: { email: { in: [FIXTURE_EMAIL_A, FIXTURE_EMAIL_B] } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  if (ids.length > 0) {
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function main() {
  const owner = privateKeyToAccount(generatePrivateKey());
  const rival = privateKeyToAccount(generatePrivateKey());

  const realBefore = await prisma.handle.count({ where: { NOT: HANDLE_WHERE } });

  await cleanup();

  const userA = await prisma.user.create({ data: { email: FIXTURE_EMAIL_A } });
  const userB = await prisma.user.create({ data: { email: FIXTURE_EMAIL_B } });
  await registerWallet({ userId: userA.id, chain: 'tempo', asset: 'ousd', address: owner.address });
  await registerWallet({ userId: userB.id, chain: 'tempo', asset: 'ousd', address: rival.address });

  const app = Fastify();
  await app.register(handleRoutes, { prefix: '/handles' });
  await app.register(publicHandleRoutes, { prefix: '/public/handles' });
  await app.ready();

  const resolve = async (q: string) => {
    const response = await app.inject({
      method: 'GET',
      url: `/handles/resolve?q=${encodeURIComponent(q)}`,
    });
    return { status: response.statusCode, body: response.json<Record<string, unknown>>() };
  };
  const resolved = (body: Record<string, unknown>) => body.handle as Record<string, unknown>;

  // ---------------------------------------------------------------------------
  // The rule is ONE rule, for a username and a business name alike
  // ---------------------------------------------------------------------------
  console.log('the handle rule agrees with the web:');
  const RULE_CASES: [string, string][] = [
    ['Java House', 'javahouse'],
    ["Mama's Kitchen & Grill", 'mamaskitchengrill'],
    ['Mamas Kitchen Grill', 'mamaskitchengrill'],
    ['Safaricom Shop', 'safaricomshop'],
    ['  Java   HOUSE  ', 'javahouse'],
    ['Ian', 'ian'],
    ['@ian', 'ian'],
    ['Café 29', 'caf29'],
    ['co.op', 'co.op'],
  ];
  for (const [name, expected] of RULE_CASES) {
    check(`backend("${name}")`, merchantHandle(name), expected);
    check(`   == web("${name}")`, webMerchantLink.merchantHandle(name), expected);
  }
  // A valid name can still derive an empty handle; both copies must agree on it.
  check('backend of a no-latin name is empty', merchantHandle('東京'), '');
  check('web of a no-latin name is empty', webMerchantLink.merchantHandle('東京'), '');
  check(
    'the business link is built from that same handle',
    webMerchantLink.merchantLink('Java House'),
    'https://seti.live/m/javahouse'
  );
  check(
    'the person link is built from that same handle',
    webMerchantLink.personLink('Ian'),
    'https://seti.live/u/ian'
  );
  check('both rules agree on the collision pair', merchantHandle(NAME_FIRST), HANDLE_COLLISION);
  check('both rules agree on the colliding name', merchantHandle(NAME_COLLIDING), HANDLE_COLLISION);

  // ---------------------------------------------------------------------------
  // (d) every merchant profile is behind a handle, on rows this suite owns
  // ---------------------------------------------------------------------------
  //
  // This asserted that six merchants from the developer's database had survived
  // the handle-namespace migration. That measured one machine: CI builds its
  // database from migrations, so those rows never exist there and the check
  // failed for a reason that had nothing to do with the code. What the migration
  // establishes is an INVARIANT — a merchant profile is behind a unique handle
  // derived from its name — so that is pinned here on six real claims.
  console.log('\n(d) every merchant profile is behind its handle:');
  const SIX_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'].map(
    (suffix) => `Check Handle Six ${suffix}`
  );
  const sixIds: string[] = [];
  for (const name of SIX_NAMES) {
    const sixMessage: HandleClaimMessage = {
      name,
      address: owner.address,
      purpose: PURPOSE_FOR_KIND.business,
      issuedAt: new Date().toISOString(),
      nonce: nonce(),
    };
    const sixClaim = await claimHandle({
      userId: userA.id,
      kind: 'business',
      ...sixMessage,
      signature: await signClaim(owner, sixMessage),
    });
    sixIds.push(sixClaim.id);
  }
  const sixRows = await prisma.handle.findMany({ where: { id: { in: sixIds } } });
  check('six claimed merchants each have a handle row', sixRows.length, 6);
  check('none of them is missing a merchant profile', sixRows.filter((r) => !r.merchantId).length, 0);
  check(
    'and every handle is the rule applied to its name',
    SIX_NAMES.every((name) =>
      sixRows.some((r) => r.handle === merchantHandle(name) && r.name === name)
    ),
    true
  );
  check('and the six handles are distinct', new Set(sixRows.map((r) => r.handle)).size, 6);
  // Business handles are scoped to their network: this one resolves on the
  // network it was claimed on, asserted through the resolver the route uses.
  check(
    'and a claim resolves on its own network',
    (await findHandleByHandle(sixRows[0].handle, servedNetwork)) !== null,
    true
  );

  const merchants = await prisma.merchant.findMany({ where: { NOT: MERCHANT_WHERE } });
  const everyMerchantHasHandle = (
    await Promise.all(
      merchants.map((m) => prisma.handle.findFirst({ where: { merchantId: m.id }, select: { id: true } }))
    )
  ).every(Boolean);
  check('every merchant profile is behind a handle', everyMerchantHasHandle, true);

  // A practice business handle is per network, so the public route — which
  // resolves on the network this deployment SERVES — must be asked for the one
  // the row is on. Pinned on a row this suite created, not on the seeded
  // `javahouse`: whether a practice business name should resolve on live is a
  // product question the owner has left open, and it is not what this asserts.
  const practiceView = await toHandleIdentityView(sixRows[0]);
  check('a claim still resolves on its own network', practiceView !== null, true);
  check('and returns the claimed name', practiceView?.name, sixRows[0].name);

  // ---------------------------------------------------------------------------
  // (a) a claim stores a handle equal to the web's rule
  // ---------------------------------------------------------------------------
  console.log('\n(a) a claim stores the web-equivalent handle:');
  const firstMessage: HandleClaimMessage = {
    name: NAME_FIRST,
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.business,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const claimed = await claimHandle({
    userId: userA.id,
    kind: 'business',
    ...firstMessage,
    signature: await signClaim(owner, firstMessage),
  });
  check('the handle is stored', claimed.handle, HANDLE_COLLISION);
  check('and equals the web rule for the same name', claimed.handle, webMerchantLink.merchantHandle(NAME_FIRST));
  check('and the binding still verifies', await handleClaimVerifies(claimed), true);

  // ---------------------------------------------------------------------------
  // (b) a colliding name from another address is refused, and the first is intact
  // ---------------------------------------------------------------------------
  console.log('\n(b) a colliding handle:');
  check('but the two names share one handle', merchantHandle(NAME_COLLIDING), HANDLE_COLLISION);

  const collision = await attemptClaim(userB.id, rival, 'business', NAME_COLLIDING, rival.address);
  check('the second claimant is refused', collision?.code, 'handle-taken');
  check('and the refusal names the handle', collision?.message.includes(HANDLE_COLLISION) ?? false, true);

  const stillHeld = await prisma.handle.findFirst({ where: { handle: HANDLE_COLLISION } });
  check('the first handle still points at the first address', stillHeld?.address, owner.address);
  check(
    'and no second row was written for the colliding name',
    await prisma.handle.count({ where: { name: { equals: NAME_COLLIDING, mode: 'insensitive' } } }),
    0
  );

  // ---------------------------------------------------------------------------
  // (b2) A PERSON'S USERNAME and this BUSINESS'S NAME compete for the same string
  // ---------------------------------------------------------------------------
  console.log("\n(b2) a person's username and a business's name, one string:");
  const personCollision = await attemptClaim(userB.id, rival, 'person', NAME_FIRST, rival.address);
  check('a person cannot take a business handle', personCollision?.code, 'handle-taken');

  // ---------------------------------------------------------------------------
  // (c) re-claiming the same handle and address is idempotent, not a refusal
  // ---------------------------------------------------------------------------
  console.log('\n(c) the idempotent re-claim:');
  const againMessage: HandleClaimMessage = {
    name: NAME_FIRST,
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.business,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const again = await claimHandle({
    userId: userA.id,
    kind: 'business',
    ...againMessage,
    signature: await signClaim(owner, againMessage),
  });
  check('the same handle/address is not refused', again.id, claimed.id);
  check('and keeps the same handle', again.handle, HANDLE_COLLISION);
  check(
    'and there is still exactly one row for it',
    await prisma.handle.count({ where: { handle: HANDLE_COLLISION } }),
    1
  );

  // ---------------------------------------------------------------------------
  // The preview speaks with the claim path's voice
  // ---------------------------------------------------------------------------
  console.log('\nthe preview:');
  const free = await handleStatus('Check Handle Free Name');
  check('a free name reports its handle', free.handle, 'checkhandlefreename');
  check('and reports it free', free.takenBy, 'null');

  const taken = await handleStatus(NAME_COLLIDING);
  check('a colliding name reports the same handle', taken.handle, HANDLE_COLLISION);
  check('and names the current holder', taken.takenBy, NAME_FIRST);

  const reserved = await handleStatus('Seti');
  check('a reserved name reports a problem', reserved.problem !== null, true);

  const noLink = await handleStatus('東京');
  check('a name that makes no link reports a problem', noLink.problem !== null, true);

  const previewOverHttp = await app.inject({
    method: 'GET',
    url: `/handles/status?name=${encodeURIComponent(NAME_COLLIDING)}`,
  });
  const previewBody = previewOverHttp.json<{ status: { takenBy: string } }>();
  check('the preview route returns 200', previewOverHttp.statusCode, 200);
  check('and reports the same holder', previewBody.status?.takenBy, NAME_FIRST);

  // ---------------------------------------------------------------------------
  // (e) resolve by handle returns the same thing as by name
  // ---------------------------------------------------------------------------
  console.log('\n(e) resolve by handle vs by name:');
  const byHandle = await resolve(HANDLE_COLLISION);
  const byHandleHandle = resolved(byHandle.body);
  check('resolve by handle returns 200', byHandle.status, 200);
  check('with the name', byHandleHandle.name, NAME_FIRST);
  check('with the handle', byHandleHandle.handle, HANDLE_COLLISION);
  check('with the address', byHandleHandle.address, owner.address);
  check('and verified', byHandleHandle.verified, true);

  const byName = await resolve(NAME_FIRST);
  const byNameHandle = resolved(byName.body);
  check('resolve by name returns the same handle', byNameHandle.id, byHandleHandle.id);
  check('same name', byNameHandle.name, byHandleHandle.name);
  check('same address', byNameHandle.address, byHandleHandle.address);
  check('same handle', byNameHandle.handle, byHandleHandle.handle);
  check('same verified', byNameHandle.verified, byHandleHandle.verified);

  // A public read needs no session at all — the page's whole premise.
  const publicRead = await app.inject({ method: 'GET', url: `/public/handles/${HANDLE_COLLISION}` });
  const publicHandle = publicRead.json<{ handle: Record<string, unknown> }>().handle;
  check('the public route needs no token', publicRead.statusCode, 200);
  check('and returns the same address', publicHandle?.address, owner.address);
  check('and the same verified', publicHandle?.verified, true);

  // ---------------------------------------------------------------------------
  // (f) an unknown handle is a 404, never some other handle
  // ---------------------------------------------------------------------------
  console.log('\n(f) an unknown handle:');
  check('an unknown handle does not resolve', (await resolve('checkhandle-unknown-xyz')).status, 404);
  check(
    'and the public route is a 404',
    (await app.inject({ method: 'GET', url: '/public/handles/checkhandle-unknown-xyz' })).statusCode,
    404
  );

  // ---------------------------------------------------------------------------
  // (g) the existing refusals still refuse
  // ---------------------------------------------------------------------------
  console.log('\n(g) the refusals that must not weaken:');
  const forged = await attemptClaim(userA.id, rival, 'business', 'Check Handle Forged', owner.address);
  check('a signature from another key is refused', forged?.code, 'signature-mismatch');

  const notOwned = await attemptClaim(userB.id, owner, 'business', 'Check Handle Not Mine', owner.address);
  check('a wallet you do not own is refused', notOwned?.code, 'address-not-owned');

  const noLinkClaim = await refusalOf(() =>
    claimHandle({
      userId: userA.id,
      kind: 'person',
      name: '東京',
      address: owner.address,
      issuedAt: new Date().toISOString(),
      nonce: nonce(),
      signature: '0x00',
    })
  );
  check('a name that makes no link is refused as a bad name', noLinkClaim?.code, 'invalid-handle-name');

  await app.close();

  // ---------------------------------------------------------------------------
  // Cleanup, and proof the money path was left alone
  // ---------------------------------------------------------------------------
  await cleanup();

  check('real handles were not touched', await prisma.handle.count({ where: { NOT: HANDLE_WHERE } }), realBefore);
  check('and no fixture was left behind', await prisma.handle.count({ where: HANDLE_WHERE }), 0);

  await prisma.$disconnect();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('handle check crashed:', error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
