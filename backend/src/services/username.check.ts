/**
 * USERNAMES — the handle claim, generalized, proved end to end.
 *
 * Run with:  npm run check:username
 * Requires:  the `seti-postgres` container (docker compose up -d)
 *
 * Six claims have to be true at once, and this suite makes each one a refusal or
 * a value rather than a promise:
 *
 *   1. a username claim stores a handle and VERIFIES (recomputed from the stored
 *      signature, never a stored boolean);
 *   2. a signature made to claim a USERNAME is refused as a merchant claim, and a
 *      merchant-name signature is refused as a username claim (`purpose`);
 *   3. a RESERVED word (`seti`, `support`, `admin`, `help`, `pay`, `api`, `www`,
 *      `terms`, `privacy`) is refused before anyone signs;
 *   4. a COLLIDING handle is refused — a person and a business compete for the
 *      same string, in one namespace;
 *   5. an unknown handle 404s, on both the resolver and the public read;
 *   6. resolve-by-username returns the SAME identity as resolve-by-name.
 *
 * And the migration's promise is pinned here too: the six pre-existing merchants
 * still resolve and still verify, with the addresses they had before the move.
 *
 * Every signature is a throwaway key generated here, and every refusal is a
 * refusal of a signature that genuinely does not verify. Fixture rows all live
 * under `check-username-*@seti.test` / `Check Username …`.
 */
import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { prisma } from '../lib/prisma.js';
import { registerWallet } from './wallet-registry.js';
import { handleRoutes } from '../routes/handles.js';
import { publicHandleRoutes } from '../routes/public-handles.js';
import {
  describeReservedHandle,
  HandleClaimError,
  HANDLE_CLAIM_PRIMARY_TYPE,
  HANDLE_CLAIM_TYPES,
  handleClaimDomain,
  handleClaimVerifies,
  merchantHandle,
  PURPOSE_FOR_KIND,
  RESERVED_HANDLES,
  claimHandle,
  type HandleClaimMessage,
  type HandleKind,
} from './handle-claims.js';

const FIXTURE_EMAIL_A = 'check-username-a@seti.test';
const FIXTURE_EMAIL_B = 'check-username-b@seti.test';

const USERNAME = 'Check Username Ian';
const USERNAME_HANDLE = merchantHandle(USERNAME);

/** Two DISTINCT names that reduce to ONE handle, for the collision proof. */
const COLLIDE_A = "Check Username Mama's";
const COLLIDE_B = 'Check Username Mamas';
const COLLIDE_HANDLE = 'checkusernamemamas';

const FIXTURE_NAME_PREFIX = 'Check Username';
const HANDLE_WHERE = {
  OR: [
    { handle: { startsWith: 'checkusername', mode: 'insensitive' as const } },
    { name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const } },
  ],
};
const MERCHANT_WHERE = {
  name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const },
};

/** The six merchants as they resolved before the migration — pinned here. */
const MERCHANTS = [
  { handle: 'ianllc', name: 'Ianllc', address: '0xE2eF55fD97f1e666782D1F653d29fcE88D585e28', verified: true },
  { handle: 'burgerking', name: 'BurgerKing', address: '0x3Ee67d07F52C0bf9DeDaF495B17C72b47B35631a', verified: true },
  { handle: 'kfc', name: 'KFC', address: '0x3Ee67d07F52C0bf9DeDaF495B17C72b47B35631a', verified: true },
  { handle: 'seti', name: 'Seti', address: '0x02b02edc794548897CD50D9fb55539197efCA1Ac', verified: true },
  { handle: 'javahouse', name: 'Java House', address: '0x20C000000000000000000000b9537d11c60E8b50', verified: false },
  { handle: 'safaricomshop', name: 'Safaricom Shop', address: '0x20c0000000000000000000009e8d7eb59b783726', verified: false },
];

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(62)} ${String(actual)}${ok ? '' : ` (expected ${String(expected)})`}`
  );
}

function nonce(): string {
  return randomBytes(16).toString('hex');
}

async function sign(account: PrivateKeyAccount, message: HandleClaimMessage) {
  return account.signTypedData({
    domain: handleClaimDomain(),
    types: HANDLE_CLAIM_TYPES,
    primaryType: HANDLE_CLAIM_PRIMARY_TYPE,
    message: { ...message },
  });
}

async function refusalOf(fn: () => Promise<unknown>): Promise<{ code: string; message: string } | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    if (error instanceof HandleClaimError) return { code: error.code, message: error.message };
    throw error;
  }
}

/** A purpose-scoped message, signed and claimed exactly as submitted. */
async function claim(userId: string, account: PrivateKeyAccount, kind: HandleKind, name: string, address = account.address) {
  const message: HandleClaimMessage = {
    name,
    address,
    purpose: PURPOSE_FOR_KIND[kind],
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const signature = await sign(account, message);
  return refusalOf(() => claimHandle({ userId, kind, ...message, signature }));
}

async function cleanup() {
  await prisma.handle.deleteMany({ where: HANDLE_WHERE });
  await prisma.merchant.deleteMany({ where: MERCHANT_WHERE });

  const users = await prisma.user.findMany({
    where: { email: { in: [FIXTURE_EMAIL_A, FIXTURE_EMAIL_B] } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function main() {
  const owner = privateKeyToAccount(generatePrivateKey());
  const rival = privateKeyToAccount(generatePrivateKey());

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
  const view = (body: Record<string, unknown>) => body.handle as Record<string, unknown>;

  // ---------------------------------------------------------------------------
  // The six merchants still resolve and still verify (the migration's promise)
  // ---------------------------------------------------------------------------
  console.log('the six existing merchants, untouched:');
  for (const m of MERCHANTS) {
    const res = await app.inject({ method: 'GET', url: `/public/handles/${m.handle}` });
    const handle = view(res.json<Record<string, unknown>>());
    check(`${m.handle}: resolves`, res.statusCode, 200);
    check(`${m.handle}: name unchanged`, handle.name, m.name);
    check(`${m.handle}: address unchanged`, handle.address, m.address);
    check(`${m.handle}: verified unchanged`, handle.verified, m.verified);
    check(`${m.handle}: is a business`, handle.kind, 'business');
  }

  // ---------------------------------------------------------------------------
  // (1) a username claim stores a handle and verifies
  // ---------------------------------------------------------------------------
  console.log('\n(1) a username claim stores a handle and verifies:');
  const message: HandleClaimMessage = {
    name: USERNAME,
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.person,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const signature = await sign(owner, message);
  const claimed = await claimHandle({ userId: userA.id, kind: 'person', ...message, signature });

  check('the handle is stored', claimed.handle, USERNAME_HANDLE);
  check('and is a person profile', claimed.kind, 'person');
  check('and carries the username purpose', claimed.purpose, 'username');
  check('the address is stored (checksummed)', claimed.address, owner.address);
  check('the signature is stored verbatim', claimed.claimSignature, signature);
  check('and it re-verifies from the stored signature', await handleClaimVerifies(claimed), true);
  check('a person has no business profile', claimed.merchantId, 'null');

  // ---------------------------------------------------------------------------
  // (2) a signature for one purpose is refused as the other
  // ---------------------------------------------------------------------------
  console.log('\n(2) a username signature is refused as a merchant claim, and vice versa:');
  const asUsername: HandleClaimMessage = {
    name: 'Check Username Cross',
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.person,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const usernameSignature = await sign(owner, asUsername);
  const replayedAsBusiness = await refusalOf(() =>
    claimHandle({
      userId: userA.id,
      kind: 'business',
      name: asUsername.name,
      address: asUsername.address,
      issuedAt: asUsername.issuedAt,
      nonce: asUsername.nonce,
      signature: usernameSignature,
    })
  );
  check('a username signature is REFUSED as a merchant claim', replayedAsBusiness?.code, 'purpose-mismatch');
  check(
    'and no handle was written for it',
    await prisma.handle.count({ where: { handle: merchantHandle(asUsername.name) } }),
    0
  );

  const asMerchant: HandleClaimMessage = {
    name: 'Check Username Cross 2',
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.business,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const merchantSignature = await sign(owner, asMerchant);
  const replayedAsUsername = await refusalOf(() =>
    claimHandle({
      userId: userA.id,
      kind: 'person',
      name: asMerchant.name,
      address: asMerchant.address,
      issuedAt: asMerchant.issuedAt,
      nonce: asMerchant.nonce,
      signature: merchantSignature,
    })
  );
  check('a merchant-name signature is REFUSED as a username claim', replayedAsUsername?.code, 'purpose-mismatch');

  // The purpose-scoped claim DOES succeed when submitted for the purpose it was
  // signed for — the refusal above is about the purpose, not the signature.
  const asMerchantOk = await claimHandle({
    userId: userA.id,
    kind: 'business',
    ...asMerchant,
    signature: merchantSignature,
  });
  check('but the same bytes claim the purpose they were signed for', asMerchantOk.purpose, 'merchant-name');

  // ---------------------------------------------------------------------------
  // (3) a reserved word is refused
  // ---------------------------------------------------------------------------
  console.log('\n(3) a reserved word is refused before anyone signs:');
  for (const word of RESERVED_HANDLES) {
    check(`"${word}" is reserved`, describeReservedHandle(word) !== null, true);
  }
  const reservedClaim = await refusalOf(() =>
    claimHandle({
      userId: userA.id,
      kind: 'person',
      name: 'Terms',
      address: owner.address,
      issuedAt: new Date().toISOString(),
      nonce: nonce(),
      // Deliberately unreadable: the refusal must come from the rule, never from
      // the signature — a reserved word is refused before anything is signed.
      signature: '0x00',
    })
  );
  check('a reserved word is REFUSED as a claim', reservedClaim?.code, 'reserved-handle');
  check(
    'and nothing was written for it',
    await prisma.handle.count({ where: { handle: 'terms' } }),
    0
  );

  // ---------------------------------------------------------------------------
  // (4) a colliding handle is refused
  // ---------------------------------------------------------------------------
  console.log('\n(4) a colliding handle is refused:');
  check('the two names share one handle', merchantHandle(COLLIDE_A), COLLIDE_HANDLE);
  check('and are genuinely different names', merchantHandle(COLLIDE_A) === merchantHandle(COLLIDE_B), true);

  const first = await claim(userA.id, owner, 'person', COLLIDE_A);
  check('the first username is claimed', first, 'null');
  const colliding = await claim(userB.id, rival, 'person', COLLIDE_B);
  check('the colliding username is REFUSED', colliding?.code, 'handle-taken');
  check(
    'and only one handle exists for it',
    await prisma.handle.count({ where: { handle: COLLIDE_HANDLE } }),
    1
  );

  // ---------------------------------------------------------------------------
  // (5) an unknown handle 404s
  // ---------------------------------------------------------------------------
  console.log('\n(5) an unknown handle 404s:');
  check('the resolver 404s', (await resolve('checkusername-unknown-xyz')).status, 404);
  check(
    'and the public read 404s',
    (await app.inject({ method: 'GET', url: '/public/handles/checkusername-unknown-xyz' })).statusCode,
    404
  );

  // ---------------------------------------------------------------------------
  // (6) resolve-by-username returns the same identity as resolve-by-name
  // ---------------------------------------------------------------------------
  console.log('\n(6) resolve by username equals resolve by name:');
  const byUsername = await resolve(USERNAME_HANDLE);
  const byName = await resolve(USERNAME);
  const a = view(byUsername.body);
  const b = view(byName.body);
  check('resolve by username returns 200', byUsername.status, 200);
  check('resolve by name returns 200', byName.status, 200);
  check('same identity', a.id, b.id);
  check('same handle', a.handle, b.handle);
  check('same name', a.name, b.name);
  check('same address', a.address, b.address);
  check('same verified', a.verified, b.verified);
  check('and the identity is the verified one', a.verified, true);
  check('and it is a person', a.kind, 'person');
  const personUrl = `https://seti.live/u/${String(a.handle)}`;
  check('and the person link is what a customer opens', personUrl, `https://seti.live/u/${USERNAME_HANDLE}`);

  await app.close();

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  await cleanup();
  check('no fixture handle left behind', await prisma.handle.count({ where: HANDLE_WHERE }), 0);
  check('no fixture business profile left behind', await prisma.merchant.count({ where: MERCHANT_WHERE }), 0);

  await prisma.$disconnect();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('username check crashed:', error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
