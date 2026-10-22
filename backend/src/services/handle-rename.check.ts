/**
 * One person name per account — and the RENAME that replaces it without breaking
 * every link already shared.
 *
 * Run with:  npm run check:rename
 * Requires:  docker compose up -d  (the `seti-postgres` container), and the
 *            migrations applied — the partial unique index this suite asserts
 *            about is created by `20261022200000_person_name_and_rename`.
 *
 * Why real signatures: the rename is a CLAIM. If it could be performed without a
 * signature it would be Seti moving a name on its own authority, which is the one
 * thing the handle feature forbids. Every claim below is signed with a throwaway
 * key generated here.
 *
 * What is pinned, in the order a person experiences it:
 *
 *  (a) the schema, not just the code: a second `kind = 'person'` row for one
 *      account is refused by Postgres;
 *  (b) the refusal a second name gets (`rename-required`) — and that the refusal
 *      NAMES the rename, because a code alone tells a client nothing it can show;
 *  (c) the rename itself: one signature, one name, the old string recorded;
 *  (d) the old string still resolving — `/u/<old>`, the resolver, `verified: true`
 *      — for the whole hold, and nobody else able to claim it;
 *  (e) the account switching back inside the window;
 *  (f) the boundary (day 29 still held, day 31 free) and the string being claimable
 *      again once it expires;
 *  (g) a name that never resolved being renamed WITHOUT a hold.
 *
 * IMPORTANT: every row this file touches belongs to a fixture user
 * (`check-rename-*@seti.test`), a fixture handle (`checkrename…`), a fixture name
 * (`Check Rename …`), or the one wallet it registers for the dev bypass user. Real
 * handles are snapshotted before and after — a handle points at where a customer's
 * money lands.
 */
import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { prisma } from '../lib/prisma.js';
import { servedNetwork } from '../config/networks.js';
import { findHandleByHandle } from './handles.js';
import { registerWallet } from './wallet-registry.js';
import { handleRoutes } from '../routes/handles.js';
import { publicHandleRoutes } from '../routes/public-handles.js';
import {
  HANDLE_CLAIM_PRIMARY_TYPE,
  HANDLE_CLAIM_TYPES,
  HandleClaimError,
  PURPOSE_FOR_KIND,
  claimHandle,
  handleClaimDomain,
  handleClaimVerifies,
  handleStatus,
  merchantHandle,
  toHandleIdentityView,
  type HandleKind,
  type Network,
  type HandleClaimMessage,
} from './handle-claims.js';
import {
  RENAME_HOLD_DAYS,
  RENAME_RELEASE_REASON,
  RENAME_UNLIVE_RELEASE_REASON,
  findActiveRenameHold,
} from './handle-rename.js';

const FIXTURE_EMAIL_A = 'check-rename-a@seti.test';
const FIXTURE_EMAIL_B = 'check-rename-b@seti.test';
const FIXTURE_EMAIL_C = 'check-rename-c@seti.test';
const DEV_EMAIL = 'dev@seti.test';

/** The one name the account starts with, and the one it renames to. */
const NAME_FIRST = 'Check Rename First';
const NAME_SECOND = 'Check Rename Second';
/** A business name pair, to prove the cap is person-only. */
const NAME_SHOP_ONE = 'Check Rename Shop One';
const NAME_SHOP_TWO = 'Check Rename Shop Two';

const FIXTURE_NAME_PREFIX = 'Check Rename';
const HANDLE_WHERE = {
  OR: [
    { handle: { startsWith: 'checkrename', mode: 'insensitive' as const } },
    { name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const } },
  ],
};
const RELEASE_WHERE = {
  handle: { startsWith: 'checkrename', mode: 'insensitive' as const },
};
const MERCHANT_WHERE = {
  name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const },
};

const DAY = 86_400_000;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(58)} ${String(actual)}${ok ? '' : ` (expected ${String(expected)})`}`
  );
}

function nonce(): string {
  return randomBytes(16).toString('hex');
}

async function signClaim(
  account: PrivateKeyAccount,
  message: HandleClaimMessage,
  network?: Network
): Promise<`0x${string}`> {
  return account.signTypedData({
    domain: handleClaimDomain(network),
    types: HANDLE_CLAIM_TYPES,
    primaryType: HANDLE_CLAIM_PRIMARY_TYPE,
    message: { ...message },
  });
}

/** Run a claim and report the typed refusal it produced, if any. */
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

/** Sign the message that is submitted, then claim it — reporting `claimed` or the code. */
async function attempt(
  userId: string,
  account: PrivateKeyAccount,
  kind: HandleKind,
  name: string,
  options: { rename?: boolean } = {}
): Promise<string> {
  const message: HandleClaimMessage = {
    name,
    address: account.address,
    purpose: PURPOSE_FOR_KIND[kind],
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const signature = await signClaim(account, message);
  const refusal = await refusalOf(() =>
    claimHandle({ userId, kind, ...message, signature, rename: options.rename })
  );
  return refusal ? refusal.code : 'claimed';
}

/** The account's person rows — there must never be more than one. */
function personRowsOf(userId: string) {
  return prisma.handle.findMany({ where: { userId, kind: 'person' } });
}

async function cleanup() {
  await prisma.handle.deleteMany({ where: HANDLE_WHERE });
  await prisma.handleRelease.deleteMany({ where: RELEASE_WHERE });
  await prisma.merchant.deleteMany({ where: MERCHANT_WHERE });

  const users = await prisma.user.findMany({
    where: { email: { in: [FIXTURE_EMAIL_A, FIXTURE_EMAIL_B, FIXTURE_EMAIL_C] } },
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
  const unsignedOwner = privateKeyToAccount(generatePrivateKey());
  const routeAccount = privateKeyToAccount(generatePrivateKey());

  const realHandlesBefore = await prisma.handle.count({ where: { NOT: HANDLE_WHERE } });
  const realReleasesBefore = await prisma.handleRelease.count({ where: { NOT: RELEASE_WHERE } });

  await cleanup();

  const userA = await prisma.user.create({ data: { email: FIXTURE_EMAIL_A } });
  const userB = await prisma.user.create({ data: { email: FIXTURE_EMAIL_B } });
  // A third account, because an account holds ONE person name: the case below
  // (a name that never resolved) needs an account whose one name is that one.
  const userC = await prisma.user.create({ data: { email: FIXTURE_EMAIL_C } });

  await registerWallet({ userId: userA.id, chain: 'tempo', asset: 'ousd', address: owner.address });
  await registerWallet({ userId: userB.id, chain: 'tempo', asset: 'ousd', address: rival.address });
  await registerWallet({ userId: userC.id, chain: 'tempo', asset: 'ousd', address: unsignedOwner.address });

  // A minimal server carrying only the handle routes: the HTTP assertions are
  // about this feature's wiring, and building the whole API would make the suite
  // fail for reasons that have nothing to do with a rename.
  const app = Fastify();
  await app.register(handleRoutes, { prefix: '/handles' });
  await app.register(publicHandleRoutes, { prefix: '/h' });
  await app.ready();

  const resolve = async (q: string) => {
    const response = await app.inject({
      method: 'GET',
      url: `/handles/resolve?q=${encodeURIComponent(q)}`,
    });
    return { status: response.statusCode, body: response.json<Record<string, unknown>>() };
  };
  const publicRead = async (handle: string) => {
    const response = await app.inject({ method: 'GET', url: `/h/${handle}` });
    return {
      status: response.statusCode,
      handle: response.json<Record<string, unknown>>().handle as
        | Record<string, unknown>
        | undefined,
    };
  };

  // -------------------------------------------------------------------------
  // (a) The rule is the SCHEMA's, not the service's
  // -------------------------------------------------------------------------
  console.log('(a) one person name per account, in the database:');
  const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
     WHERE tablename = 'handles' AND indexname = 'handles_person_user_key'
  `;
  check('the partial unique index exists (migration applied)', indexes.length, 1);

  check(
    'the account claims its FIRST username',
    await attempt(userA.id, owner, 'person', NAME_FIRST),
    'claimed'
  );
  const firstRow = await prisma.handle.findFirstOrThrow({
    where: { handle: merchantHandle(NAME_FIRST) },
  });
  check('one person row for the account', (await personRowsOf(userA.id)).length, 1);

  // The index, not the code: a write that bypasses `claimHandle` cannot create a
  // second name either. This is what makes the rule hold against a future writer,
  // a raw SQL import or an agent.
  const bypassed = await prisma.handle
    .create({
      data: {
        handle: 'checkrenamebypass',
        network: servedNetwork,
        kind: 'person',
        name: 'Check Rename Bypass',
        address: owner.address,
        userId: userA.id,
      },
    })
    .then(() => 'created')
    .catch((error: { code?: string }) => error.code ?? 'error');
  check('a raw second person row is refused by Postgres', bypassed, 'P2002');
  check('and the account still holds exactly one', (await personRowsOf(userA.id)).length, 1);

  // -------------------------------------------------------------------------
  // (b) A second name is refused, and the refusal NAMES the rename
  // -------------------------------------------------------------------------
  console.log('\n(b) a second name without a rename:');
  const secondAttempt = await refusalOf(() => {
    const message: HandleClaimMessage = {
      name: NAME_SECOND,
      address: owner.address,
      purpose: PURPOSE_FOR_KIND.person,
      issuedAt: new Date().toISOString(),
      nonce: nonce(),
    };
    return signClaim(owner, message).then((signature) =>
      claimHandle({ userId: userA.id, kind: 'person', ...message, signature })
    );
  });
  check('a second username is refused with its own code', secondAttempt?.code, 'rename-required');
  check('the copy names the name they already hold', Boolean(secondAttempt?.message.includes(merchantHandle(NAME_FIRST))), true);
  check('the copy names the rename', Boolean(secondAttempt?.message.toLowerCase().includes('renam')), true);
  check('the copy names the 30-day hold', Boolean(secondAttempt?.message.includes(`${RENAME_HOLD_DAYS} days`)), true);
  check('and says nothing was changed', Boolean(secondAttempt?.message.includes('Nothing was changed')), true);

  check('nothing was written for the refused name', await prisma.handle.count({ where: { handle: merchantHandle(NAME_SECOND) } }), 0);
  check('no release was recorded for a refusal', await prisma.handleRelease.count({ where: RELEASE_WHERE }), 0);
  check('and the account still holds its one name', (await personRowsOf(userA.id))[0]?.handle, merchantHandle(NAME_FIRST));

  // -------------------------------------------------------------------------
  // (c) The rename: ONE signature, one name, the old string recorded
  // -------------------------------------------------------------------------
  console.log('\n(c) the rename:');
  const renameMessage: HandleClaimMessage = {
    name: NAME_SECOND,
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.person,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const renameSignature = await signClaim(owner, renameMessage);
  const renamed = await claimHandle({
    userId: userA.id,
    kind: 'person',
    ...renameMessage,
    signature: renameSignature,
    rename: true,
  });

  check('the new name is stored', renamed.handle, merchantHandle(NAME_SECOND));
  check('with the ONE signature that claimed it', renamed.claimSignature, renameSignature);
  check('signed for the username purpose', renamed.purpose, 'username');
  check('and it verifies from that signature alone', await handleClaimVerifies(renamed), true);

  const afterRename = await personRowsOf(userA.id);
  check('the account holds exactly one person name', afterRename.length, 1);
  check('and it is the new one', afterRename[0]?.handle, merchantHandle(NAME_SECOND));
  check('the old string no longer has a handle row', await prisma.handle.count({ where: { handle: merchantHandle(NAME_FIRST) } }), 0);

  const release = await prisma.handleRelease.findFirst({
    where: { handle: merchantHandle(NAME_FIRST) },
  });
  check('the old string was RELEASED, not deleted', release !== null, true);
  check('with the reason a rename records', release?.reason, RENAME_RELEASE_REASON);
  check('to NO recipient — the account kept it', release?.reassignedTo, 'null');
  check('keeping the OLD signature, so it can re-verify', release?.claimSignature, firstRow.claimSignature);
  check('keeping the purpose it was signed for', release?.purpose, firstRow.purpose);
  check('keeping the network it was signed on', release?.network, firstRow.network);
  check('and the account that holds it', release?.userId, userA.id);

  const audit = await prisma.auditLog.findFirst({
    where: { action: 'handle.person.renamed', userId: userA.id },
    orderBy: { createdAt: 'desc' },
  });
  check('the rename is on the audit trail', audit !== null, true);
  const auditMetadata = (audit?.metadata ?? {}) as Record<string, unknown>;
  check('naming what it came from', auditMetadata.from, merchantHandle(NAME_FIRST));
  check('and what it went to', auditMetadata.to, merchantHandle(NAME_SECOND));
  check('and when the old name stops working', typeof auditMetadata.oldHandleHeldUntil, 'string');

  // -------------------------------------------------------------------------
  // (d) The old string keeps resolving — for the whole hold
  // -------------------------------------------------------------------------
  console.log('\n(d) the old string during the hold:');
  const held = await findActiveRenameHold(merchantHandle(NAME_FIRST));
  check('a live hold exists for the old string', held !== null, true);

  const oldRow = await findHandleByHandle(merchantHandle(NAME_FIRST), servedNetwork);
  const oldView = oldRow ? await toHandleIdentityView(oldRow) : null;
  check('the old string still resolves', oldView !== null, true);
  check('to the renamed account’s address', oldView?.address, owner.address);
  check('and still reads as VERIFIED', oldView?.verified, true);
  check('as a person', oldView?.kind, 'person');
  check('under the old name, not the new one', oldView?.name, NAME_FIRST);

  const oldPublic = await publicRead(merchantHandle(NAME_FIRST));
  check('GET /h/<old> (what /u/<old> renders) returns 200', oldPublic.status, 200);
  check('with the address the money goes to', oldPublic.handle?.address, owner.address);
  check('and verified: true', oldPublic.handle?.verified, true);

  const oldViaResolve = await resolve(merchantHandle(NAME_FIRST));
  check('the resolver agrees', oldViaResolve.status, 200);
  check(
    'and reads the same identity',
    (oldViaResolve.body.handle as Record<string, unknown> | undefined)?.address,
    owner.address
  );

  const newResolves = await resolve(merchantHandle(NAME_SECOND));
  check('the NEW name resolves too', newResolves.status, 200);

  // Nobody else: not another account, not on the other network, and the preview
  // that a claim form reads must agree rather than say "free".
  check(
    'another account cannot claim the held name',
    await attempt(userB.id, rival, 'person', NAME_FIRST),
    'handle-taken'
  );
  const rivalRefusal = await refusalOf(() => {
    const message: HandleClaimMessage = {
      name: NAME_FIRST,
      address: rival.address,
      purpose: PURPOSE_FOR_KIND.person,
      issuedAt: new Date().toISOString(),
      nonce: nonce(),
    };
    // Signed for LIVE, because that is the network this claim is submitted on: a
    // practice-domain signature would be refused as `signature-mismatch` long
    // before the hold is reached, and this assertion is about the hold.
    return signClaim(rival, message, 'mainnet').then((signature) =>
      claimHandle({ userId: userB.id, kind: 'person', ...message, signature, network: 'mainnet' })
    );
  });
  check('nor on the other network (a username is global)', rivalRefusal?.code, 'handle-taken');
  check('and the refusal says why it is not free', Boolean(rivalRefusal?.message.includes(`${RENAME_HOLD_DAYS} days`)), true);

  const preview = await handleStatus(NAME_FIRST, servedNetwork, 'person');
  check('the claim preview does not call the held name free', preview.takenBy, NAME_FIRST);

  // One string is one name (#141), so the hold protects the STRING and not just the
  // person namespace: a business claim of a held username is refused too. Otherwise
  // the business's own row would win `findHandleByHandle` on the network it claimed
  // and the renamed account's shared link would pay the business.
  check(
    'a business cannot claim the held username either',
    await attempt(userB.id, rival, 'business', NAME_FIRST),
    'handle-taken'
  );
  check(
    'no business row was written for the held string',
    await prisma.handle.count({
      where: { handle: merchantHandle(NAME_FIRST), kind: 'business' },
    }),
    0
  );
  const businessPreview = await handleStatus(NAME_FIRST, servedNetwork, 'business');
  check('and the business claim form agrees it is taken', businessPreview.takenBy, NAME_FIRST);

  // -------------------------------------------------------------------------
  // (e) The renaming account may switch back inside the window
  // -------------------------------------------------------------------------
  console.log('\n(e) switching back inside the window:');
  check(
    'the account that renamed can claim its old name again',
    await attempt(userA.id, owner, 'person', NAME_FIRST, { rename: true }),
    'claimed'
  );
  const backRows = await personRowsOf(userA.id);
  check('still exactly one person name', backRows.length, 1);
  check('and it is the old one', backRows[0]?.handle, merchantHandle(NAME_FIRST));
  const backView = await findHandleByHandle(merchantHandle(NAME_FIRST));
  check('which resolves from its own row again', backView !== null, true);
  check(
    'and the name it just left is now the held one',
    (await findActiveRenameHold(merchantHandle(NAME_SECOND))) !== null,
    true
  );

  // -------------------------------------------------------------------------
  // (f) The boundary: held on day 29, free after day 30
  // -------------------------------------------------------------------------
  console.log('\n(f) the hold expiring:');
  const heldRelease = await prisma.handleRelease.findFirstOrThrow({
    where: { handle: merchantHandle(NAME_SECOND), reason: RENAME_RELEASE_REASON },
  });

  // Backdate the release to day 29 of the hold. Time is not a test fixture, so the
  // window is moved rather than waited out — the same rule the expiry itself reads.
  await prisma.handleRelease.update({
    where: { id: heldRelease.id },
    data: { createdAt: new Date(Date.now() - 29 * DAY) },
  });
  check('day 29: the hold is still live', (await findActiveRenameHold(merchantHandle(NAME_SECOND))) !== null, true);
  check('day 29: the old string still resolves', (await findHandleByHandle(merchantHandle(NAME_SECOND))) !== null, true);
  check(
    'day 29: another account is still refused',
    await attempt(userB.id, rival, 'person', NAME_SECOND),
    'handle-taken'
  );

  // Day 31: the window is over.
  await prisma.handleRelease.update({
    where: { id: heldRelease.id },
    data: { createdAt: new Date(Date.now() - (RENAME_HOLD_DAYS + 1) * DAY) },
  });
  check('day 31: the hold is over', await findActiveRenameHold(merchantHandle(NAME_SECOND)), 'null');
  check('day 31: the old string no longer resolves', await findHandleByHandle(merchantHandle(NAME_SECOND)), 'null');

  const expiredPreview = await handleStatus(NAME_SECOND, servedNetwork, 'person');
  check('day 31: the preview calls it free again', expiredPreview.takenBy, 'null');
  check(
    'day 31: another account can claim it',
    await attempt(userB.id, rival, 'person', NAME_SECOND),
    'claimed'
  );
  const claimedByRival = await prisma.handle.findFirstOrThrow({
    where: { handle: merchantHandle(NAME_SECOND) },
  });
  check('and it resolves to whoever claimed it', claimedByRival.address, rival.address);
  check('and the account that renamed is not locked out of its OWN name', (await personRowsOf(userA.id))[0]?.handle, merchantHandle(NAME_FIRST));

  // -------------------------------------------------------------------------
  // (g) A name that never resolved is renamed WITHOUT a hold
  // -------------------------------------------------------------------------
  console.log('\n(g) renaming away from a name that never resolved:');
  const unsignedName = 'Check Rename Unsigned';
  const unsignedRow = await prisma.handle.create({
    data: {
      handle: merchantHandle(unsignedName),
      network: servedNetwork,
      kind: 'person',
      name: unsignedName,
      address: unsignedOwner.address,
      userId: userC.id,
      // No signature: a half-written claim, or the leftover of a session that
      // never finished signing. It holds the string and was never payable, so
      // there is nothing behind it to carry into a hold.
    },
  });
  check('the unsigned name was never verified', await handleClaimVerifies(unsignedRow), false);
  check(
    'and the account renames away from it',
    await attempt(userC.id, unsignedOwner, 'person', 'Check Rename Unsigned Two', { rename: true }),
    'claimed'
  );
  const unsignedRelease = await prisma.handleRelease.findFirst({
    where: { handle: merchantHandle(unsignedName) },
  });
  check('the unsigned string is recorded as released', unsignedRelease !== null, true);
  check('with the not-live reason, not the held one', unsignedRelease?.reason, RENAME_UNLIVE_RELEASE_REASON);
  check('so no hold was created for it', await findActiveRenameHold(merchantHandle(unsignedName)), 'null');
  check('and the string does not resolve', await findHandleByHandle(merchantHandle(unsignedName)), 'null');
  check('and the account has its one new name', (await personRowsOf(userC.id))[0]?.handle, merchantHandle('Check Rename Unsigned Two'));

  // -------------------------------------------------------------------------
  // (h) Business names are NOT capped — the rule is about a person's identity
  // -------------------------------------------------------------------------
  console.log('\n(h) a business may still hold more than one name:');
  check('a merchant claims its first name', await attempt(userA.id, owner, 'business', NAME_SHOP_ONE), 'claimed');
  check('and a second one', await attempt(userA.id, owner, 'business', NAME_SHOP_TWO), 'claimed');
  check(
    'both business rows exist for the one account',
    await prisma.handle.count({ where: { userId: userA.id, kind: 'business' } }),
    2
  );

  // -------------------------------------------------------------------------
  // (i) A leftover row on the new string is taken over, not collided with
  // -------------------------------------------------------------------------
  console.log('\n(i) renaming onto a leftover, ownerless row:');
  const orphanName = 'Check Rename Orphan';
  await prisma.handle.create({
    data: {
      handle: merchantHandle(orphanName),
      network: servedNetwork,
      kind: 'person',
      name: orphanName,
      // No `userId`: a claim posted by a session that no longer exists. The same
      // address as the renaming account, which is the only way a row on the target
      // string gets past the collision check at all.
      address: owner.address,
    },
  });
  check(
    'the account renames onto the leftover row',
    await attempt(userA.id, owner, 'person', orphanName, { rename: true }),
    'claimed'
  );
  const adopted = await prisma.handle.findMany({ where: { handle: merchantHandle(orphanName) } });
  check('there is exactly one row for the string', adopted.length, 1);
  check('and the account owns it now', adopted[0]?.userId, userA.id);
  check('and it is the account’s one person name', (await personRowsOf(userA.id))[0]?.handle, merchantHandle(orphanName));

  // -------------------------------------------------------------------------
  // The route: the rename over HTTP needs the flag, and does the same thing
  // -------------------------------------------------------------------------
  console.log('\n(j) the rename over HTTP:');
  const devUser = await prisma.user.upsert({
    where: { email: DEV_EMAIL },
    update: {},
    create: { email: DEV_EMAIL },
  });
  await registerWallet({
    userId: devUser.id,
    chain: 'tempo',
    asset: 'pathusd',
    address: routeAccount.address,
  });

  const routeFirst: HandleClaimMessage = {
    name: 'Check Rename Route One',
    address: routeAccount.address,
    purpose: PURPOSE_FOR_KIND.person,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const routeFirstPost = await app.inject({
    method: 'POST',
    url: '/handles/claim',
    payload: { kind: 'person', ...routeFirst, signature: await signClaim(routeAccount, routeFirst) },
  });
  check('POST /handles/claim makes it the username', routeFirstPost.statusCode, 201);

  const routeSecond: HandleClaimMessage = {
    name: 'Check Rename Route Two',
    address: routeAccount.address,
    purpose: PURPOSE_FOR_KIND.person,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const routeSecondSignature = await signClaim(routeAccount, routeSecond);

  const withoutFlag = await app.inject({
    method: 'POST',
    url: '/handles/claim',
    payload: { kind: 'person', ...routeSecond, signature: routeSecondSignature },
  });
  check('a second name over HTTP is refused', withoutFlag.statusCode, 409);
  check('with the typed code in the envelope', withoutFlag.json<Record<string, unknown>>().code, 'rename-required');

  const withFlag = await app.inject({
    method: 'POST',
    url: '/handles/claim',
    payload: { kind: 'person', ...routeSecond, signature: routeSecondSignature, rename: true },
  });
  const withFlagHandle = withFlag.json<Record<string, unknown>>().handle as Record<string, unknown>;
  check('the same claim with rename: true is accepted', withFlag.statusCode, 201);
  check('and the response is the new name', withFlagHandle.handle, merchantHandle('Check Rename Route Two'));

  await app.close();

  // -------------------------------------------------------------------------
  // Cleanup and the "nothing real was touched" proof
  // -------------------------------------------------------------------------
  await cleanup();
  await prisma.wallet.deleteMany({ where: { address: routeAccount.address } });

  check('no fixture handle left behind', await prisma.handle.count({ where: HANDLE_WHERE }), 0);
  check('no fixture release left behind', await prisma.handleRelease.count({ where: RELEASE_WHERE }), 0);
  check('no fixture business profile left behind', await prisma.merchant.count({ where: MERCHANT_WHERE }), 0);
  check('real handles were not touched', await prisma.handle.count({ where: { NOT: HANDLE_WHERE } }), realHandlesBefore);
  check(
    'real release records were not touched',
    await prisma.handleRelease.count({ where: { NOT: RELEASE_WHERE } }),
    realReleasesBefore
  );

  await prisma.$disconnect();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('handle rename check crashed:', error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
