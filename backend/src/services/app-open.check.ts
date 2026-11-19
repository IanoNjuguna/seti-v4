/**
 * APP OPEN — the retention counter, and the day it buckets (#571).
 *
 * Run with:  npm run check:app-open
 * Requires:  the `seti-postgres` container (docker compose up -d)
 *
 * The claims this suite pins:
 *
 *   (a) the FIRST look at an account on a local day writes exactly one
 *       `app.open` row, and that row carries `metadata.day` and
 *       `metadata.timeZone` — the day is stored, not re-derived later;
 *   (b) a second look the same local day writes no second row;
 *   (c) a look on the NEXT local day writes exactly one more;
 *   (d) the day belongs to the ACCOUNT's zone, not UTC: one instant at 23:30Z is
 *       the next day for `Africa/Nairobi` and the same day for `UTC`;
 *   (e) two accounts at the same instant each get their own row — the dedupe is
 *       per account, never global;
 *   (f) over HTTP, through the REAL `/auth/me` route the app loads on: one row on
 *       the first call and none on the second;
 *   (g) a write that FAILS does not fail the request — the account is still
 *       returned, which is the whole reason the call sits in a try/catch;
 *   (h) the stored day SURVIVES a zone change: an account that moves zone still
 *       reports the days it was counted on, because nothing re-buckets history.
 *
 * On (f)/(g): the HTTP leg runs the route through the dev-bypass identity
 * (`DEV_BYPASS_AUTH=true`, `NODE_ENV=development`), which is the same middleware
 * every other route uses. The write is disabled for (g) by making the audit
 * `create` reject in-process, then restored — the alternative, asserting that a
 * `try` exists, is the kind of check this repo does not accept.
 *
 * IMPORTANT: every row this suite touches belongs to a fixture account
 * (`check-app-open-*@seti.test`), plus the dev-bypass account's OWN rows written
 * by the HTTP leg, which are counted and removed. It deletes what it created and
 * says how many rows it left behind.
 */
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authRoutes } from '../routes/auth.js';
import { recordAppOpen } from './app-open.js';
import { localMoment } from './time-zone.js';

let passed = 0;
let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`ok    ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? `  ${detail}` : ''}`);
  }
}

const DAY = 24 * 60 * 60 * 1000;

/** The id the route answered with, typed rather than `any` so a shape change is a compile error. */
function userIdOf(payload: unknown): string | undefined {
  return (payload as { user?: { id?: string } }).user?.id;
}

const EMAIL_NAIROBI = 'check-app-open-nairobi@seti.test';
const EMAIL_UTC = 'check-app-open-utc@seti.test';
const EMAIL_OTHER = 'check-app-open-other@seti.test';
const FIXTURE_EMAILS = [EMAIL_NAIROBI, EMAIL_UTC, EMAIL_OTHER];
const DEV_TEST_EMAIL = 'dev@seti.test';

/** Every `app.open` row this suite caused, so cleanup can be exact. */
const createdAuditIds: string[] = [];

async function rowCount(userId: string): Promise<number> {
  return prisma.auditLog.count({ where: { userId, action: 'app.open' } });
}

async function rows(userId: string) {
  return prisma.auditLog.findMany({
    where: { userId, action: 'app.open' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, metadata: true },
  });
}

async function cleanup(): Promise<void> {
  if (createdAuditIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
    createdAuditIds.length = 0;
  }
  // Anything else carrying the action on a fixture account is ours too.
  await prisma.auditLog.deleteMany({
    where: { action: 'app.open', user: { email: { in: FIXTURE_EMAILS } } },
  });
  await prisma.user.deleteMany({ where: { email: { in: FIXTURE_EMAILS } } });
}

async function main(): Promise<void> {
  const usersBefore = await prisma.user.count();

  await cleanup();

  const nairobi = await prisma.user.create({
    data: { email: EMAIL_NAIROBI, timeZone: 'Africa/Nairobi' },
  });
  const utc = await prisma.user.create({ data: { email: EMAIL_UTC, timeZone: 'UTC' } });
  const other = await prisma.user.create({
    data: { email: EMAIL_OTHER, timeZone: 'Africa/Nairobi' },
  });

  // ---------------------------------------------------------------- (a), (b), (c)
  console.log('one row per account per local day:');
  {
    const morning = new Date('2026-11-15T09:00:00Z');
    const first = await recordAppOpen({
      userId: nairobi.id,
      timeZone: 'Africa/Nairobi',
      now: morning,
    });
    check('the first look writes the day', first.recorded, JSON.stringify(first));
    check('and it buckets to the local date', first.day === '2026-11-15', first.day);

    const afterFirst = await rows(nairobi.id);
    createdAuditIds.push(...afterFirst.map((row) => row.id));
    check('the row exists', afterFirst.length === 1, String(afterFirst.length));

    const metadata = (afterFirst[0]?.metadata ?? {}) as { day?: string; timeZone?: string };
    check('the day is STORED on the row, not re-derived later', metadata.day === '2026-11-15', String(metadata.day));
    check('and the zone it was bucketed in is stored beside it', metadata.timeZone === 'Africa/Nairobi', String(metadata.timeZone));

    const again = await recordAppOpen({
      userId: nairobi.id,
      timeZone: 'Africa/Nairobi',
      now: new Date('2026-11-15T12:00:00Z'),
    });
    check('a second look the same local day is refused', !again.recorded, JSON.stringify(again));
    check('and writes nothing', (await rowCount(nairobi.id)) === 1);

    // The boundary the fixture above deliberately does NOT sit on: 21:00Z is
    // exactly midnight in Nairobi, so it belongs to the 16th and must NOT be
    // treated as a second look at the 15th. Written as its own claim because a
    // same-day fixture at 15:00 local would pass whether or not the edge works.
    const atMidnightLocal = localMoment(new Date('2026-11-15T21:00:00Z'), 'Africa/Nairobi').date;
    check('exactly midnight local is already the next day', atMidnightLocal === '2026-11-16', atMidnightLocal);

    const tomorrow = await recordAppOpen({
      userId: nairobi.id,
      timeZone: 'Africa/Nairobi',
      now: new Date(morning.getTime() + DAY),
    });
    check('the next local day is a new row', tomorrow.recorded, tomorrow.day);
    check('so the account now has two days', (await rowCount(nairobi.id)) === 2);
    createdAuditIds.push(...(await rows(nairobi.id)).map((row) => row.id));
  }

  // ------------------------------------------------------------------------- (d)
  console.log('a day belongs to the account zone, not to UTC:');
  {
    // 23:30Z on the 15th is 02:30 on the 16th in Nairobi (UTC+3).
    const instant = new Date('2026-11-15T23:30:00Z');

    const inNairobi = await recordAppOpen({
      userId: utc.id,
      timeZone: 'Africa/Nairobi',
      now: instant,
    });
    const inUtc = await recordAppOpen({ userId: other.id, timeZone: 'UTC', now: instant });

    check('Nairobi keeps the same instant on the NEXT day', inNairobi.day === '2026-11-16', inNairobi.day);
    check('UTC keeps the same instant on the same day', inUtc.day === '2026-11-15', inUtc.day);
    check('so one instant is two different days for two accounts', inNairobi.day !== inUtc.day);
    check(
      'and the zone is read from the account, not from the clock',
      localMoment(instant, 'Africa/Nairobi').date === inNairobi.day &&
        localMoment(instant, 'UTC').date === inUtc.day
    );

    createdAuditIds.push(...(await rows(utc.id)).map((row) => row.id));
    createdAuditIds.push(...(await rows(other.id)).map((row) => row.id));
  }

  // ------------------------------------------------------------------------- (e)
  console.log('the dedupe is per account, never global:');
  {
    const instant = new Date('2026-11-17T10:00:00Z');
    const a = await recordAppOpen({ userId: utc.id, timeZone: 'UTC', now: instant });
    const b = await recordAppOpen({ userId: other.id, timeZone: 'Africa/Nairobi', now: instant });
    check('two accounts at one instant both write', a.recorded && b.recorded);
    check('each has its own row', (await rowCount(utc.id)) === 2 && (await rowCount(other.id)) === 2);
    createdAuditIds.push(...(await rows(utc.id)).map((row) => row.id));
    createdAuditIds.push(...(await rows(other.id)).map((row) => row.id));
  }

  // ------------------------------------------------------------------------ (h)
  console.log('a stored day survives a zone change:');
  {
    const before = await rows(other.id);
    const days = before.map((row) => (row.metadata as { day?: string }).day);
    await prisma.user.update({ where: { id: other.id }, data: { timeZone: 'America/New_York' } });
    const after = await rows(other.id);
    const daysAfter = after.map((row) => (row.metadata as { day?: string }).day);
    check(
      'moving zone does not rewrite the days already counted',
      JSON.stringify(days) === JSON.stringify(daysAfter),
      JSON.stringify(daysAfter)
    );
    await prisma.user.update({ where: { id: other.id }, data: { timeZone: 'Africa/Nairobi' } });
  }

  // ------------------------------------------------------------------------- (f)
  console.log('the real route the app loads on:');
  {
    const devUser = await prisma.user.upsert({
      where: { email: DEV_TEST_EMAIL },
      update: {},
      create: { email: DEV_TEST_EMAIL },
    });
    const devRowsBefore = await rowCount(devUser.id);

    const app = Fastify();
    await app.register(authRoutes, { prefix: '/auth' });
    await app.ready();

    const headers = { authorization: 'Bearer dev-bypass' };
    const first = await app.inject({ method: 'GET', url: '/auth/me', headers });
    check('the route answers', first.statusCode === 200, String(first.statusCode));
    check('and names the account', Boolean(userIdOf(first.json())));

    const devRowsAfter = await rowCount(devUser.id);
    check('one row was written for this open', devRowsAfter === devRowsBefore + 1, `${devRowsBefore} -> ${devRowsAfter}`);

    const second = await app.inject({ method: 'GET', url: '/auth/me', headers });
    check('a second load answers too', second.statusCode === 200, String(second.statusCode));
    check('and writes nothing more', (await rowCount(devUser.id)) === devRowsAfter);

    // --------------------------------------------------------------------- (g)
    // The write is disabled by replacing the client method IN PROCESS: the claim
    // is that a failed measurement cannot fail a session, and the only way to
    // prove that is to make it actually fail.
    type AuditCreate = (args: unknown) => Promise<unknown>;
    const audit = prisma.auditLog as unknown as { create: AuditCreate };
    const realCreate = audit.create;
    let refused = 0;
    audit.create = async () => {
      refused += 1;
      throw new Error('check-app-open: the audit write was made to fail');
    };
    try {
      await prisma.auditLog.deleteMany({ where: { userId: devUser.id, action: 'app.open' } });
      const during = await app.inject({ method: 'GET', url: '/auth/me', headers });
      check('a failing measurement does not fail the session', during.statusCode === 200, String(during.statusCode));
      check('the account is still returned', Boolean(userIdOf(during.json())));
      check('and the write really was attempted', refused > 0, String(refused));
    } finally {
      audit.create = realCreate;
    }

    await app.close();
    // The HTTP leg wrote into the dev-bypass account, which is not a fixture.
    await prisma.auditLog.deleteMany({ where: { userId: devUser.id, action: 'app.open' } });
    check('the dev account is left as it was found', (await rowCount(devUser.id)) === devRowsBefore);
  }

  // ---------------------------------------------------------------- the cleanup
  await cleanup();
  const usersAfter = await prisma.user.count();
  const strayRows = await prisma.auditLog.count({
    where: { action: 'app.open', user: { email: { in: [...FIXTURE_EMAILS, DEV_TEST_EMAIL] } } },
  });

  console.log('-'.repeat(74));
  console.log(
    `accounts: ${usersBefore} before, ${usersAfter} after  |  stray app.open rows: ${strayRows}`
  );
  check('the suite leaves no accounts behind', usersBefore === usersAfter, `${usersBefore} -> ${usersAfter}`);
  check('and no rows behind', strayRows === 0, String(strayRows));

  console.log('-'.repeat(74));
  console.log(failures === 0 ? `All ${passed} checks passed.` : `${failures} of ${passed + failures} checks FAILED.`);
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
