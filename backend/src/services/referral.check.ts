/**
 * INVITES — the link, the code, and who it credits. Proved end to end.
 *
 * Run with:  npm run check:referral
 * Requires:  the `seti-postgres` container (docker compose up -d)
 *
 * What this pins, in the order the product does it:
 *
 *   1. opening a link alone writes NO row — the code is minted, the count is
 *      untouched, and the invitee is still nobody;
 *   2. a sign-up carrying the code writes EXACTLY one row, naming the referrer by
 *      id and freezing the handle the link carried;
 *   3. a second link cannot re-attribute the same person (the unique index is the
 *      rule, and it is exercised rather than described);
 *   4. a returning account (not newly created) is never attributed;
 *   5. self-referral writes nothing;
 *   6. an unknown, expired, forged or malformed code writes nothing and does not
 *      throw — the silent refusal is a return value;
 *   7. a PARKED handle invites nobody: it mints no code at all, so there is
 *      nothing to replay;
 *   8. the dev-bypass account neither invites nor arrives;
 *   9. `GET /referrals/me` answers with the four fields the screen needs and
 *      never with the invitee's email;
 *  10. the link the API builds is the link the web builds (one host, pinned).
 *
 * SIGN-UP ITSELF CANNOT BE DRIVEN HERE, and that is stated rather than papered
 * over: `POST /auth/verify` needs a Privy token this suite has no way to mint. So
 * the suite drives `attributeSignupInvite` — the exact function that route calls,
 * with the same two facts (`created`, the code) — and the route's call site is one
 * statement whose inputs are visible in the diff. What the suite CAN and does prove
 * is that the decision is inside the writer: `created: false` is refused by the
 * function itself, not by a caller remembering to check.
 *
 * FIXTURE DISCIPLINE (the same as `merchant-claims.check.ts`): every row this file
 * touches belongs to a `check-referral-*@seti.test` account or a `checkreferral*`
 * handle. Real referral rows are snapshotted before and verified after, and only
 * rows naming a fixture account are deleted.
 */
import path from 'node:path';
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { referralRoutes } from '../routes/referrals.js';
import {
  INVITE_TTL_SECONDS,
  attributeSignupInvite,
  inviteCodeFor,
  inviteLink,
  issueInviteCode,
  readInviteCode,
  referralSummary,
} from './referral.js';

/**
 * The web's own link builder, imported at RUNTIME.
 *
 * A static `import` would be rejected by `tsc` (web/ is outside this package's
 * project), and a copy of the host here would be the drift this assertion exists to
 * catch. Same pattern as `check:handle`.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webLinks = require(path.resolve(__dirname, '../../../web/lib/merchant-link.ts')) as {
  inviteLink: (handle: string) => string;
};

const INVITER_EMAIL = 'check-referral-inviter@seti.test';
const INVITEE_A_EMAIL = 'check-referral-invitee-a@seti.test';
const INVITEE_B_EMAIL = 'check-referral-invitee-b@seti.test';
const INVITEE_C_EMAIL = 'check-referral-invitee-c@seti.test';
const PARKED_EMAIL = 'check-referral-parked@seti.test';
const SHOP_EMAIL = 'check-referral-shop@seti.test';
const NOBODY_EMAIL = 'check-referral-nobody@seti.test';

const INVITER_HANDLE = 'checkreferralinviter';
const INVITEE_B_HANDLE = 'checkreferralinviteeb';
const PARKED_HANDLE = 'checkreferralparked';
const SHOP_HANDLE = 'checkreferralshop';

/** Every fixture, so cleanup is one predicate rather than a list that drifts. */
const FIXTURE_EMAILS = [
  INVITER_EMAIL,
  INVITEE_A_EMAIL,
  INVITEE_B_EMAIL,
  INVITEE_C_EMAIL,
  PARKED_EMAIL,
  SHOP_EMAIL,
  NOBODY_EMAIL,
];
const FIXTURE_HANDLE_PREFIX = 'checkreferral';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(64)} ${String(actual)}${ok ? '' : ` (expected ${String(expected)})`}`
  );
}

/** A placeholder address. Nothing signs with it; a handle row needs one column. */
function addressFor(seed: string): string {
  return `0x${Buffer.from(seed).toString('hex').padEnd(40, '0').slice(0, 40)}`;
}

async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { in: FIXTURE_EMAILS } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);

  if (ids.length > 0) {
    // Referral rows first, explicitly: the foreign keys cascade, but doing it here
    // means a future schema change cannot leave an orphan behind quietly.
    await prisma.referral.deleteMany({
      where: { OR: [{ referrerId: { in: ids } }, { invitedUserId: { in: ids } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.handle.deleteMany({
    where: { handle: { startsWith: FIXTURE_HANDLE_PREFIX } },
  });
}

async function main(): Promise<void> {
  // The REAL rows, before anything is written: "untouched" is measured against the
  // database as it was found, not against a list of ids this file happens to know.
  const preexisting = await prisma.referral.findMany({ select: { id: true } });
  const preexistingIds = new Set(preexisting.map((row) => row.id));
  const preexistingCount = preexisting.length;

  await cleanup();

  const inviter = await prisma.user.create({ data: { email: INVITER_EMAIL } });
  const inviteeA = await prisma.user.create({ data: { email: INVITEE_A_EMAIL } });
  const inviteeB = await prisma.user.create({ data: { email: INVITEE_B_EMAIL } });
  const inviteeC = await prisma.user.create({ data: { email: INVITEE_C_EMAIL } });
  const parkedOwner = await prisma.user.create({ data: { email: PARKED_EMAIL } });
  const shopOwner = await prisma.user.create({ data: { email: SHOP_EMAIL } });
  const noHandleOwner = await prisma.user.create({ data: { email: NOBODY_EMAIL } });

  await prisma.handle.create({
    data: {
      handle: INVITER_HANDLE,
      name: 'Check Referral Inviter',
      kind: 'person',
      address: addressFor('inviter'),
      userId: inviter.id,
    },
  });
  await prisma.handle.create({
    data: {
      handle: INVITEE_B_HANDLE,
      name: 'Check Referral Invitee B',
      kind: 'person',
      address: addressFor('invitee-b'),
      userId: inviteeB.id,
    },
  });
  // Parked for brand review: it keeps its string, and the resolver hides it.
  await prisma.handle.create({
    data: {
      handle: PARKED_HANDLE,
      name: 'Check Referral Parked',
      kind: 'person',
      address: addressFor('parked'),
      userId: parkedOwner.id,
      reviewStatus: 'pending',
      reviewBrand: 'Check Referral Brand',
    },
  });
  // A business name: a shop invites nobody, and this is the proof.
  await prisma.handle.create({
    data: {
      handle: SHOP_HANDLE,
      name: 'Check Referral Shop',
      kind: 'business',
      address: addressFor('shop'),
      userId: shopOwner.id,
    },
  });

  const app = Fastify();
  await app.register(referralRoutes, { prefix: '/referrals' });
  await app.ready();

  const invite = async (handle: string) => {
    const response = await app.inject({
      method: 'GET',
      url: `/referrals/invite/${encodeURIComponent(handle)}`,
    });
    return { status: response.statusCode, body: response.json<{ code: string | null }>() };
  };

  const rowCount = () => prisma.referral.count();
  const rowsFor = (userId: string) => prisma.referral.count({ where: { referrerId: userId } });

  // ---------------------------------------------------------------------------
  // (1) opening a link writes nothing
  // ---------------------------------------------------------------------------
  console.log('(1) a link open is a visit, not a person:');
  const opened = await invite(INVITER_HANDLE);
  check('the link mints a code', typeof opened.body.code, 'string');
  check('and answers 200', opened.status, 200);
  check('opening it writes no row', await rowCount(), preexistingCount);
  const code = opened.body.code as string;
  const verified = readInviteCode(code);
  check('the code names the referrer by ID', verified?.referrerId, inviter.id);
  check('and carries the handle as a snapshot', verified?.referrerHandle, INVITER_HANDLE);

  // ---------------------------------------------------------------------------
  // (2) a sign-up carrying the code writes exactly one row
  // ---------------------------------------------------------------------------
  console.log('\n(2) a new account is attributed exactly once:');
  check(
    'the sign-up is attributed',
    await attributeSignupInvite({ userId: inviteeA.id, created: true, code }),
    'attributed'
  );
  const first = await prisma.referral.findUnique({ where: { invitedUserId: inviteeA.id } });
  check('one row exists for the invitee', first !== null, true);
  check('naming the referrer', first?.referrerId, inviter.id);
  check('with the handle the link carried', first?.referrerHandle, INVITER_HANDLE);
  check('and no second row', await rowCount(), preexistingCount + 1);

  // ---------------------------------------------------------------------------
  // (3) a second link cannot re-attribute the same person
  // ---------------------------------------------------------------------------
  console.log('\n(3) a second invite cannot take credit:');
  check(
    'replaying the same code is a duplicate',
    await attributeSignupInvite({ userId: inviteeA.id, created: true, code }),
    'duplicate'
  );
  const freshCode = issueInviteCode(noHandleOwner.id, 'checkreferralsomeone');
  check(
    'and so is a different, valid code',
    await attributeSignupInvite({ userId: inviteeA.id, created: true, code: freshCode }),
    'duplicate'
  );
  const stillFirst = await prisma.referral.findUnique({ where: { invitedUserId: inviteeA.id } });
  check('the original attribution stands', stillFirst?.referrerId, inviter.id);
  check('and there is still one row', await rowCount(), preexistingCount + 1);

  // ---------------------------------------------------------------------------
  // (4) new accounts only
  // ---------------------------------------------------------------------------
  console.log('\n(4) a returning account is not an arrival:');
  check(
    'no row for an account that already existed',
    await attributeSignupInvite({ userId: inviteeB.id, created: false, code }),
    'not-new-account'
  );
  check('and the count is unchanged', await rowCount(), preexistingCount + 1);
  check(
    'the same code does attribute the new account',
    await attributeSignupInvite({ userId: inviteeB.id, created: true, code }),
    'attributed'
  );
  check('which is the second row', await rowCount(), preexistingCount + 2);

  // ---------------------------------------------------------------------------
  // (5) never self
  // ---------------------------------------------------------------------------
  console.log('\n(5) nobody invites themselves:');
  const ownCode = await inviteCodeFor(INVITEE_B_HANDLE);
  check('an account can mint its own link', typeof ownCode, 'string');
  check(
    'but signing up on it attributes nobody',
    await attributeSignupInvite({ userId: inviteeB.id, created: true, code: ownCode }),
    'self'
  );
  check(
    'and the row it already has still names the real inviter',
    (await prisma.referral.findUnique({ where: { invitedUserId: inviteeB.id } }))?.referrerId,
    inviter.id
  );

  // ---------------------------------------------------------------------------
  // (6) unknown, expired, forged and malformed codes are ignored silently
  // ---------------------------------------------------------------------------
  console.log('\n(6) a dead code is a dead code, quietly:');
  const unknown = await invite(INVITER_HANDLE.replace('inviter', 'nobody'));
  check('an unknown handle mints nothing', unknown.body.code, 'null');
  check('and answers 200 rather than 404', unknown.status, 200);

  check(
    'a missing code attributes nobody',
    await attributeSignupInvite({ userId: inviteeC.id, created: true, code: null }),
    'no-code'
  );
  check(
    'an unparseable code attributes nobody',
    await attributeSignupInvite({ userId: inviteeC.id, created: true, code: 'not-a-code' }),
    'no-code'
  );

  const expired = issueInviteCode(
    inviter.id,
    INVITER_HANDLE,
    Date.now() - (INVITE_TTL_SECONDS + 60) * 1000
  );
  check('an expired code no longer reads', readInviteCode(expired), 'null');
  check(
    'and attributes nobody',
    await attributeSignupInvite({ userId: inviteeC.id, created: true, code: expired }),
    'no-code'
  );

  // A code whose payload is edited but whose signature is not: the signature check
  // runs before the JSON is read, so this cannot name a different referrer.
  const [forgedBody, forgedSignature] = code.split('.');
  const decoded = JSON.parse(Buffer.from(forgedBody, 'base64url').toString('utf8')) as {
    r: string;
    h: string;
    exp: number;
  };
  const forgedPayload = { ...decoded, r: inviteeC.id };
  const forged = `${Buffer.from(JSON.stringify(forgedPayload)).toString('base64url')}.${forgedSignature}`;
  check('a re-signed payload is refused', readInviteCode(forged), 'null');
  check(
    'and attributes nobody',
    await attributeSignupInvite({ userId: inviteeC.id, created: true, code: forged }),
    'no-code'
  );
  check('no row for any of those', await prisma.referral.count({ where: { invitedUserId: inviteeC.id } }), 0);
  check('and the total is untouched', await rowCount(), preexistingCount + 2);

  // ---------------------------------------------------------------------------
  // (7) a parked handle invites nobody
  // ---------------------------------------------------------------------------
  console.log('\n(7) a parked name is not a name:');
  const parked = await invite(PARKED_HANDLE);
  check('a parked handle mints no code', parked.body.code, 'null');
  check('and answers 200, not 404', parked.status, 200);
  check('so nothing is attributable', await rowsFor(parkedOwner.id), 0);

  const shop = await invite(SHOP_HANDLE);
  check('a business name mints no code', shop.body.code, 'null');

  // ---------------------------------------------------------------------------
  // (8) the dev bypass neither invites nor arrives
  // ---------------------------------------------------------------------------
  console.log('\n(8) the development fixture is nobody:');
  const dev = await prisma.user.upsert({
    where: { email: 'dev@seti.test' },
    update: {},
    create: { email: 'dev@seti.test' },
  });
  await prisma.handle.deleteMany({ where: { handle: 'checkreferraldev' } });
  await prisma.handle.create({
    data: {
      handle: 'checkreferraldev',
      name: 'Check Referral Dev',
      kind: 'person',
      address: addressFor('dev'),
      userId: dev.id,
    },
  });
  check('its link mints nothing', await inviteCodeFor('checkreferraldev'), 'null');
  check(
    'a code naming it attributes nobody',
    await attributeSignupInvite({
      userId: inviteeC.id,
      created: true,
      code: issueInviteCode(dev.id, 'checkreferraldev'),
    }),
    'dev-account'
  );
  check(
    'and it arrives on nobody (its own sign-up attributes nothing)',
    await attributeSignupInvite({ userId: dev.id, created: true, code }),
    'dev-account'
  );
  check('no row for the dev account either way', await rowsFor(dev.id), 0);

  // ---------------------------------------------------------------------------
  // (9) what a referrer may know
  // ---------------------------------------------------------------------------
  console.log('\n(9) the referrer learns a handle and a date, nothing else:');
  const summary = await referralSummary(inviter.id);

  check('the payload is exactly four fields', Object.keys(summary).sort().join(','), 'count,handle,joined,link');
  check('the handle is the live one', summary.handle, INVITER_HANDLE);
  check('the link is the invite link', summary.link, `https://seti.live/i/${INVITER_HANDLE}`);
  check('the count is the people who joined', summary.count, 2);
  check('the list holds both of them', summary.joined.length, 2);
  check(
    'newest first',
    summary.joined[0]?.handle,
    INVITEE_B_HANDLE
  );
  check('and an invitee with no name yet reads as null', summary.joined[1]?.handle, 'null');

  const serialised = JSON.stringify(summary);
  for (const email of [INVITEE_A_EMAIL, INVITEE_B_EMAIL]) {
    check(`the invitee email ${email.includes('a@') ? 'A' : 'B'} is nowhere in it`, serialised.includes(email), false);
  }
  check('no address is in it', /0x[0-9a-f]{6}/i.test(serialised), false);
  check('no invitee id is in it', serialised.includes(inviteeA.id) || serialised.includes(inviteeB.id), false);
  check(
    'a join carries only a handle and a date',
    Object.keys(summary.joined[0] ?? {}).sort().join(','),
    'handle,joinedAt'
  );

  const noHandle = await referralSummary(noHandleOwner.id);
  check('an account with no username has no handle', noHandle.handle, 'null');
  check('and is offered no link', noHandle.link, 'null');
  check('though it may still have counted nobody', noHandle.count, 0);

  // The route itself, through the real auth middleware (the dev bypass resolves
  // this process's shared fixture), so the endpoint is exercised and not only the
  // service behind it. This asserts SHAPE, which is what the screen reads.
  if (process.env.DEV_BYPASS_AUTH === 'true') {
    const me = await app.inject({ method: 'GET', url: '/referrals/me' });
    check('GET /referrals/me answers for a session', me.statusCode, 200);
    check(
      'with the same four fields',
      Object.keys(me.json<Record<string, unknown>>()).sort().join(','),
      'count,handle,joined,link'
    );
  }

  // ---------------------------------------------------------------------------
  // (10) one host, two builders
  // ---------------------------------------------------------------------------
  console.log('\n(10) the link the API builds is the link the web builds:');
  check('the web builds the same invite link', webLinks.inviteLink(INVITER_HANDLE), inviteLink(INVITER_HANDLE));
  check('and the API link is the /i/ route', inviteLink(INVITER_HANDLE), `https://seti.live/i/${INVITER_HANDLE}`);

  // ---------------------------------------------------------------------------
  // The rows that were here before are still here, unchanged.
  // ---------------------------------------------------------------------------
  console.log('\nreal attribution, untouched:');
  const after = await prisma.referral.findMany({ select: { id: true } });
  const survivors = after.filter((row) => preexistingIds.has(row.id)).length;
  check(`every pre-existing row survives (${preexistingCount} found)`, survivors, preexistingCount);

  await cleanup();

  const finalCount = await prisma.referral.count();
  check('cleanup leaves only the real rows behind', finalCount, preexistingCount);

  await app.close();

  console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch(async (error) => {
    console.error(error);
    await cleanup().catch(() => undefined);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
