/**
 * The merchant handle, against live Postgres and REAL EIP-712 signatures.
 *
 * Run with:  npm run check:handle
 * Requires:  the `seti-postgres` container (docker compose up -d)
 *
 * Why real signatures: the handle is only meaningful because the CLAIM that
 * stores it is proved by the address's key. A fixture that inserted a handle
 * directly would test the column, not the claim-time rule this feature exists
 * for. Every claim and refusal below is driven by a throwaway key generated here.
 *
 * What this pins, above all: the handle the BACKEND computes is the handle the
 * WEB's link is built from. They are two implementations of one rule, and the web
 * module is imported here at RUNTIME and compared value-for-value, so a drift
 * fails the gate rather than shipping a link that points somewhere else.
 *
 * IMPORTANT: every row this file touches belongs to a fixture user
 * (`check-handle-*@seti.test`) or a fixture merchant (`Check Handle …`). The real
 * merchants and the seeded seed rows are snapshotted and checked unchanged.
 */
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { prisma } from '../lib/prisma.js';
import { registerWallet } from './wallet-registry.js';
import {
  MerchantClaimError,
  MERCHANT_CLAIM_PRIMARY_TYPE,
  MERCHANT_CLAIM_TYPES,
  claimMerchantName,
  merchantClaimDomain,
  merchantClaimVerifies,
  merchantHandle,
  merchantHandleStatus,
  merchantNameKey,
  type MerchantClaimMessage,
} from './merchant-claims.js';
import { merchantRoutes } from '../routes/merchants.js';
import { publicMerchantRoutes } from '../routes/public-merchants.js';

/**
 * The web's own handle rule and link builder, imported at RUNTIME.
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
};

const FIXTURE_EMAIL_A = 'check-handle-a@seti.test';
const FIXTURE_EMAIL_B = 'check-handle-b@seti.test';

/**
 * The collision pair — two DISTINCT names that reduce to ONE handle.
 *
 * `Mama's Grill` keeps an apostrophe the handle rule drops; `Mamas Grill` never
 * had one. Their `nameKey`s differ (the apostrophe is in the key), so both are
 * claimable names; their handles are identical. That is the exact ambiguity this
 * feature exists to refuse.
 */
const NAME_FIRST = "Check Handle Mama's Grill";
const NAME_COLLIDING = 'Check Handle Mamas Grill';
const HANDLE_COLLISION = 'checkhandlemamasgrill';

const FIXTURE_NAME_PREFIX = 'Check Handle';
const FIXTURE_WHERE = {
  OR: [
    { nameKey: { in: [merchantNameKey(NAME_FIRST), merchantNameKey(NAME_COLLIDING)] } },
    { name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const } },
  ],
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
  message: MerchantClaimMessage
): Promise<`0x${string}`> {
  return account.signTypedData({
    domain: merchantClaimDomain(),
    types: MERCHANT_CLAIM_TYPES,
    primaryType: MERCHANT_CLAIM_PRIMARY_TYPE,
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
    if (error instanceof MerchantClaimError) return { code: error.code, message: error.message };
    throw error;
  }
}

/** Sign exactly the submitted message, then claim it, reporting any refusal. */
async function attemptClaim(
  userId: string,
  account: PrivateKeyAccount,
  message: MerchantClaimMessage
) {
  const signature = await signClaim(account, message);
  return refusalOf(() => claimMerchantName({ userId, ...message, signature }));
}

async function cleanup() {
  await prisma.merchant.deleteMany({ where: FIXTURE_WHERE });

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

  const realBefore = await prisma.merchant.count({ where: { NOT: FIXTURE_WHERE } });

  await cleanup();

  const userA = await prisma.user.create({ data: { email: FIXTURE_EMAIL_A } });
  const userB = await prisma.user.create({ data: { email: FIXTURE_EMAIL_B } });
  await registerWallet({ userId: userA.id, chain: 'tempo', asset: 'ousd', address: owner.address });
  await registerWallet({ userId: userB.id, chain: 'tempo', asset: 'ousd', address: rival.address });

  const app = Fastify();
  await app.register(merchantRoutes, { prefix: '/merchants' });
  await app.register(publicMerchantRoutes, { prefix: '/public/merchants' });
  await app.ready();

  const resolve = async (qr: string) => {
    const response = await app.inject({
      method: 'GET',
      url: `/merchants/resolve?qr=${encodeURIComponent(qr)}`,
    });
    return { status: response.statusCode, body: response.json<Record<string, unknown>>() };
  };
  const resolved = (body: Record<string, unknown>) => body.merchant as Record<string, unknown>;

  // ---------------------------------------------------------------------------
  // The rule is ONE rule: the backend's equals the web's, exactly
  // ---------------------------------------------------------------------------
  console.log('the handle rule agrees with the web:');
  const RULE_CASES: [string, string][] = [
    ['Java House', 'javahouse'],
    ["Mama's Kitchen & Grill", 'mamaskitchengrill'],
    ['Mamas Kitchen Grill', 'mamaskitchengrill'],
    ['Safaricom Shop', 'safaricomshop'],
    ['  Java   HOUSE  ', 'javahouse'],
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
    'the link is built from that same handle',
    webMerchantLink.merchantLink('Java House'),
    'https://seti.live/m/javahouse'
  );
  check('both rules agree on the collision pair', merchantHandle(NAME_FIRST), HANDLE_COLLISION);
  check('both rules agree on the colliding name', merchantHandle(NAME_COLLIDING), HANDLE_COLLISION);

  // ---------------------------------------------------------------------------
  // (d) the backfill gave every pre-existing merchant a handle, and they resolve
  // ---------------------------------------------------------------------------
  console.log('\n(d) the backfill:');
  const seeded = await prisma.merchant.findUnique({ where: { id: 'merchant_java_house' } });
  check('Java House got a handle', seeded?.handle, 'javahouse');
  const safari = await prisma.merchant.findUnique({ where: { id: 'merchant_safari_com' } });
  check('Safaricom Shop got a handle', safari?.handle, 'safaricomshop');
  const seti = await prisma.merchant.findFirst({ where: { nameKey: 'seti' } });
  check('the claimed Seti merchant got a handle', seti?.handle, 'seti');

  const backfilled = await prisma.merchant.findMany({
    where: { NOT: FIXTURE_WHERE },
    select: { id: true, handle: true },
  });
  check(
    'every pre-existing merchant has a handle',
    backfilled.every((merchant) => Boolean(merchant.handle)),
    true
  );

  const seededResolve = await app.inject({ method: 'GET', url: '/public/merchants/javahouse' });
  check('a seeded handle resolves publicly', seededResolve.statusCode, 200);
  check(
    'and returns the seeded merchant',
    seededResolve.json<{ merchant: Record<string, unknown> }>().merchant?.name,
    'Java House'
  );

  // ---------------------------------------------------------------------------
  // (a) a claim stores a handle equal to the web's rule
  // ---------------------------------------------------------------------------
  console.log('\n(a) a claim stores the web-equivalent handle:');
  const firstMessage: MerchantClaimMessage = {
    name: NAME_FIRST,
    address: owner.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const claimed = await claimMerchantName({
    userId: userA.id,
    ...firstMessage,
    signature: await signClaim(owner, firstMessage),
  });
  check('the handle is stored', claimed.handle, HANDLE_COLLISION);
  check('and equals the web rule for the same name', claimed.handle, webMerchantLink.merchantHandle(NAME_FIRST));
  check('and the binding still verifies', await merchantClaimVerifies(claimed), true);

  // ---------------------------------------------------------------------------
  // (b) a colliding name from another address is refused, and the first is intact
  // ---------------------------------------------------------------------------
  console.log('\n(b) a colliding handle:');
  check(
    'the two names are genuinely different names',
    merchantNameKey(NAME_FIRST) === merchantNameKey(NAME_COLLIDING),
    false
  );
  check('but share one handle', merchantHandle(NAME_COLLIDING), HANDLE_COLLISION);

  const collision = await attemptClaim(userB.id, rival, {
    name: NAME_COLLIDING,
    address: rival.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  });
  check('the second claimant is refused', collision?.code, 'handle-taken');
  check('and the refusal names the handle', collision?.message.includes(HANDLE_COLLISION) ?? false, true);

  const stillHeld = await prisma.merchant.findFirst({ where: { handle: HANDLE_COLLISION } });
  check('the first merchant still holds the handle', stillHeld?.id, claimed.id);
  check('and still points at the first address', stillHeld?.payoutAddress, owner.address);
  check(
    'and no second row was written for the colliding name',
    await prisma.merchant.count({ where: { nameKey: merchantNameKey(NAME_COLLIDING) } }),
    0
  );

  // ---------------------------------------------------------------------------
  // (c) re-claiming the same name and address is idempotent, not a refusal
  // ---------------------------------------------------------------------------
  console.log('\n(c) the idempotent re-claim:');
  const againMessage: MerchantClaimMessage = {
    name: NAME_FIRST,
    address: owner.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const again = await claimMerchantName({
    userId: userA.id,
    ...againMessage,
    signature: await signClaim(owner, againMessage),
  });
  check('the same name/address is not refused', again.id, claimed.id);
  check('and keeps the same handle', again.handle, HANDLE_COLLISION);
  check(
    'and there is still exactly one row for it',
    await prisma.merchant.count({ where: { nameKey: merchantNameKey(NAME_FIRST) } }),
    1
  );

  // ---------------------------------------------------------------------------
  // The preview speaks with the claim path's voice
  // ---------------------------------------------------------------------------
  console.log('\nthe preview:');
  const free = await merchantHandleStatus('Check Handle Free Name');
  check('a free name reports its handle', free.handle, 'checkhandlefreename');
  check('and reports it free', free.takenBy, 'null');

  const taken = await merchantHandleStatus(NAME_COLLIDING);
  check('a colliding name reports the same handle', taken.handle, HANDLE_COLLISION);
  check('and names the current holder', taken.takenBy, NAME_FIRST);

  const noLink = await merchantHandleStatus('東京');
  check('a name that makes no link reports a problem', noLink.problem !== null, true);

  const previewOverHttp = await app.inject({
    method: 'GET',
    url: `/merchants/handle?name=${encodeURIComponent(NAME_COLLIDING)}`,
  });
  const previewBody = previewOverHttp.json<{ status: { takenBy: string } }>();
  check('the preview route returns 200', previewOverHttp.statusCode, 200);
  check('and reports the same holder', previewBody.status?.takenBy, NAME_FIRST);

  // ---------------------------------------------------------------------------
  // (e) resolve by handle returns the same thing as by name
  // ---------------------------------------------------------------------------
  console.log('\n(e) resolve by handle vs by name:');
  const byHandle = await resolve(HANDLE_COLLISION);
  const byHandleMerchant = resolved(byHandle.body);
  check('resolve by handle returns 200', byHandle.status, 200);
  check('with the name', byHandleMerchant.name, NAME_FIRST);
  check('with the handle', byHandleMerchant.handle, HANDLE_COLLISION);
  check('with the address', byHandleMerchant.payoutAddress, owner.address);
  check('and verified', byHandleMerchant.verified, true);

  const byName = await resolve(NAME_FIRST);
  const byNameMerchant = resolved(byName.body);
  check('resolve by name returns the same merchant', byNameMerchant.id, byHandleMerchant.id);
  check('same name', byNameMerchant.name, byHandleMerchant.name);
  check('same address', byNameMerchant.payoutAddress, byHandleMerchant.payoutAddress);
  check('same handle', byNameMerchant.handle, byHandleMerchant.handle);
  check('same verified', byNameMerchant.verified, byHandleMerchant.verified);

  // A public read needs no session at all — the page's whole premise.
  const publicRead = await app.inject({ method: 'GET', url: `/public/merchants/${HANDLE_COLLISION}` });
  const publicMerchant = publicRead.json<{ merchant: Record<string, unknown> }>().merchant;
  check('the public route needs no token', publicRead.statusCode, 200);
  check('and returns the same address', publicMerchant?.payoutAddress, owner.address);
  check('and the same verified', publicMerchant?.verified, true);

  // ---------------------------------------------------------------------------
  // (f) an unknown handle is a 404, never some other merchant
  // ---------------------------------------------------------------------------
  console.log('\n(f) an unknown handle:');
  check('an unknown handle does not resolve', (await resolve('checkhandle-unknown-xyz')).status, 404);
  check(
    'and the public route is a 404',
    (await app.inject({ method: 'GET', url: '/public/merchants/checkhandle-unknown-xyz' })).statusCode,
    404
  );

  // ---------------------------------------------------------------------------
  // (g) the existing refusals still refuse
  // ---------------------------------------------------------------------------
  console.log('\n(g) the refusals that must not weaken:');
  const forged = await attemptClaim(userA.id, rival, {
    name: 'Check Handle Forged',
    address: owner.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  });
  check('a signature from another key is refused', forged?.code, 'signature-mismatch');

  const notOwned = await attemptClaim(userB.id, owner, {
    name: 'Check Handle Not Mine',
    address: owner.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  });
  check('a wallet you do not own is refused', notOwned?.code, 'address-not-owned');

  const nameTaken = await attemptClaim(userB.id, rival, {
    name: NAME_FIRST,
    address: rival.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  });
  check('an exact name already claimed is refused as name-taken', nameTaken?.code, 'name-taken');

  // The name-taken check must precede the handle check, or a same-name claim
  // would be reported as a handle collision.
  check(
    'and the original merchant is untouched',
    (await prisma.merchant.findFirst({ where: { nameKey: merchantNameKey(NAME_FIRST) } }))?.payoutAddress,
    owner.address
  );

  const noLinkClaim = await refusalOf(() =>
    claimMerchantName({
      userId: userA.id,
      name: '東京',
      address: owner.address,
      issuedAt: new Date().toISOString(),
      nonce: nonce(),
      signature: '0x00',
    })
  );
  check('a name that makes no link is refused as a bad name', noLinkClaim?.code, 'invalid-merchant-name');

  await app.close();

  // ---------------------------------------------------------------------------
  // Cleanup, and proof the money path was left alone
  // ---------------------------------------------------------------------------
  await cleanup();

  const seededAfter = await prisma.merchant.findUnique({ where: { id: 'merchant_java_house' } });
  check(
    'the seeded merchant is untouched',
    seededAfter?.payoutAddress,
    '0x20C000000000000000000000b9537d11c60E8b50'
  );
  check('and kept its handle', seededAfter?.handle, 'javahouse');
  check('and carries no claim signature', seededAfter?.claimSignature, 'null');

  check('real merchants were not touched', await prisma.merchant.count({ where: { NOT: FIXTURE_WHERE } }), realBefore);
  check('and no fixture was left behind', await prisma.merchant.count({ where: FIXTURE_WHERE }), 0);

  await prisma.$disconnect();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('merchant handle check crashed:', error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
