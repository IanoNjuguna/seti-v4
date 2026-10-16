/**
 * CONSENT RECORDING — the terms version recorded against a new account.
 *
 * Run with:  npm run check:consent        (the script sets DEV_BYPASS_AUTH=true)
 * Requires:  the `seti-postgres` container (docker compose up -d) and, for the
 *            HTTP leg, PRIVY_APP_ID / PRIVY_APP_SECRET in `backend/.env`
 *
 * The claims this suite pins:
 *
 *   (a) creating an account writes EXACTLY ONE `user.consent-recorded` row, and
 *       that row names the version in force — the one `legal/terms.ts` exports,
 *       imported here rather than restated;
 *   (b) creating the SAME account again writes NO second row and does NOT
 *       overwrite the first (same id, same `createdAt`, same metadata);
 *   (c) a second, DIFFERENT account gets its own single row;
 *   (d) a client that accepted a DIFFERENT version is REFUSED, and nothing is
 *       created — no account and no row;
 *   (e) the record is the SERVER's version even when the client sends one: a
 *       matching client version changes nothing about what is written, and the
 *       client's claim is kept only as `metadata.acceptedVersion`;
 *   (f) the same thing over HTTP, through the REAL `/auth/verify` route.
 *
 * On (f): a live Privy access token cannot be minted in a test, so the two calls
 * the route makes to Privy (`verifyAuthToken`, `getUserById`) are STUBBED on the
 * module's own client object. Everything else is production code — the route, the
 * schema, the account creation, the audit write and the database. The suite is
 * run in its own process, so the stub cannot leak anywhere.
 *
 * IMPORTANT: every row this suite touches belongs to a fixture user
 * (`check-consent-*@seti.test`, DIDs `did:privy:check-consent-*`), and it deletes
 * them all on the way out. It counts real users before and after to prove it.
 */
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authRoutes } from '../routes/auth.js';
import { privy } from './auth.js';
import { isPrivyConfigured } from './auth.js';
import { createAccount } from './signup.js';
import { checkAcceptedTermsVersion, TERMS_VERSION } from './consent.js';

const EMAIL_A = 'check-consent-a@seti.test';
const EMAIL_B = 'check-consent-b@seti.test';
const EMAIL_HTTP = 'check-consent-http@seti.test';
const FIXTURE_EMAILS = [EMAIL_A, EMAIL_B, EMAIL_HTTP];
const DID_A = 'did:privy:check-consent-a';
const DID_HTTP = 'did:privy:check-consent-http';
const WALLET_HTTP = `0x${'c1'.repeat(20)}`;

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(70)} ${String(actual)}${
      ok ? '' : ` (expected ${String(expected)})`
    }`
  );
}

/** The consent rows for one account, oldest first. */
async function consentRows(userId: string) {
  return prisma.auditLog.findMany({
    where: { userId, action: 'user.consent-recorded' },
    orderBy: { createdAt: 'asc' },
  });
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { in: FIXTURE_EMAILS } }, { privyDid: { in: [DID_A, DID_HTTP] } }] },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  if (ids.length > 0) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

/** The shape the route reads out of Privy, stubbed at that boundary. */
interface PrivyStub {
  verifyAuthToken: (token: string) => Promise<{ userId: string }>;
  getUserById: (id: string) => Promise<{
    email: { address: string };
    linkedAccounts: Array<{ type: string; address: string; walletClientType: string }>;
  }>;
}

async function main() {
  const realUsersBefore = await prisma.user.count({
    where: { email: { notIn: [...FIXTURE_EMAILS, 'dev@seti.test'] } },
  });

  await cleanup();

  // ---------------------------------------------------------------------------
  // (a) an account creation writes exactly one consent row, at the version in force
  // ---------------------------------------------------------------------------
  console.log(`(a) one creation, one consent row (terms in force: ${TERMS_VERSION}):`);
  const first = await createAccount({
    email: EMAIL_A,
    acceptedVersion: TERMS_VERSION,
    ip: '127.0.0.1',
  });
  check('the account was created', first.ok ? first.created : 'refused', true);

  const rowsAfterFirst = first.ok ? await consentRows(first.userId) : [];
  check('exactly ONE consent row exists', rowsAfterFirst.length, 1);

  const row = rowsAfterFirst[0];
  console.log('      the row as stored:');
  console.log(
    `        ${JSON.stringify({
      id: row?.id,
      userId: row?.userId,
      action: row?.action,
      ip: row?.ip,
      metadata: row?.metadata,
      createdAt: row?.createdAt,
    })}`
  );
  check('the row names the terms version in force', (row?.metadata as { termsVersion?: string })?.termsVersion, TERMS_VERSION);
  check('the row names the account', row?.userId, first.ok ? first.userId : 'none');
  check('the row records a timestamp', row?.createdAt instanceof Date, true);
  check('the row keeps the client claim as evidence', (row?.metadata as { acceptedVersion?: string })?.acceptedVersion, TERMS_VERSION);

  // ---------------------------------------------------------------------------
  // (b) the same account again — no second row, and the first is untouched
  // ---------------------------------------------------------------------------
  console.log('\n(b) creating the SAME account again writes nothing and overwrites nothing:');
  const second = await createAccount({
    email: EMAIL_A,
    acceptedVersion: TERMS_VERSION,
    ip: '10.0.0.9',
  });
  check('the second call created nothing', second.ok ? second.created : 'refused', false);
  check('and it is the same account', second.ok ? second.userId : 'none', first.ok ? first.userId : 'none');

  const rowsAfterSecond = first.ok ? await consentRows(first.userId) : [];
  check('there is still exactly ONE consent row', rowsAfterSecond.length, 1);
  check('the row id is unchanged', rowsAfterSecond[0]?.id, row?.id);
  check(
    'the recorded version is unchanged',
    (rowsAfterSecond[0]?.metadata as { termsVersion?: string })?.termsVersion,
    TERMS_VERSION
  );
  check('the row was not rewritten (same createdAt)', rowsAfterSecond[0]?.createdAt.toISOString(), row?.createdAt.toISOString());
  check('and the second call did not re-record the IP', rowsAfterSecond[0]?.ip, row?.ip);

  // ---------------------------------------------------------------------------
  // (c) a second, different account gets its own single row
  // ---------------------------------------------------------------------------
  console.log('\n(c) a second account gets its own single row:');
  const other = await createAccount({ email: EMAIL_B, acceptedVersion: TERMS_VERSION });
  check('the second account was created', other.ok ? other.created : 'refused', true);
  check('it has exactly one consent row', other.ok ? (await consentRows(other.userId)).length : -1, 1);
  check(
    'and the first account still has exactly one',
    first.ok ? (await consentRows(first.userId)).length : -1,
    1
  );
  check(
    'the two rows are different rows',
    first.ok && other.ok ? (await consentRows(first.userId))[0]?.id !== (await consentRows(other.userId))[0]?.id : false,
    true
  );

  // ---------------------------------------------------------------------------
  // (d) a client that accepted a different version is refused, and nothing is written
  // ---------------------------------------------------------------------------
  console.log('\n(d) a different accepted version is refused before anything is written:');
  const stale = await createAccount({ email: 'check-consent-stale@seti.test', acceptedVersion: '1999-01-01' });
  check('the creation is refused', stale.ok, false);
  check('with the typed code', stale.ok ? 'none' : stale.code, 'terms-version-stale');
  check(
    'and no account was created for it',
    await prisma.user.count({ where: { email: 'check-consent-stale@seti.test' } }),
    0
  );
  check('the pure check agrees', checkAcceptedTermsVersion('1999-01-01')?.code, 'terms-version-stale');
  check('the pure check passes the version in force', checkAcceptedTermsVersion(TERMS_VERSION), null);
  check('the pure check passes an absent version', checkAcceptedTermsVersion(undefined), null);

  // ---------------------------------------------------------------------------
  // (e) the record is the SERVER's version, whatever the client sends
  // ---------------------------------------------------------------------------
  console.log("\n(e) the recorded version is the server's, not the client's:");
  const claimed = '2020-12-31';
  check('a wrong claim is refused rather than downgraded', (await createAccount({ email: EMAIL_B, acceptedVersion: claimed })).ok, false);
  const withClaim = await createAccount({ email: 'check-consent-claim@seti.test', acceptedVersion: TERMS_VERSION });
  const claimRow = withClaim.ok ? (await consentRows(withClaim.userId))[0] : null;
  check('the recorded version is the server’s', (claimRow?.metadata as { termsVersion?: string })?.termsVersion, TERMS_VERSION);
  if (withClaim.ok) {
    await prisma.auditLog.deleteMany({ where: { userId: withClaim.userId } });
    await prisma.user.deleteMany({ where: { id: withClaim.userId } });
  }

  // ---------------------------------------------------------------------------
  // (f) the same thing over HTTP, through the real /auth/verify route
  // ---------------------------------------------------------------------------
  console.log('\n(f) through the real POST /auth/verify route:');
  if (!isPrivyConfigured() || !privy) {
    console.log(
      '      SKIPPED — PRIVY_APP_ID / PRIVY_APP_SECRET are unset, so the route answers 503\n' +
        '      and there is no client to stub. Set them in backend/.env to run this leg.'
    );
  } else {
    // A stub at the NETWORK boundary only: the route, the schema, the account
    // creation, the audit write and the database are all production code.
    const stub = privy as unknown as PrivyStub;
    stub.verifyAuthToken = async () => ({ userId: DID_HTTP });
    stub.getUserById = async () => ({
      email: { address: EMAIL_HTTP },
      linkedAccounts: [
        { type: 'wallet', address: WALLET_HTTP, walletClientType: 'privy' },
      ],
    });

    const app = Fastify();
    await app.register(authRoutes, { prefix: '/auth' });
    await app.ready();

    const created = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { token: 'stub-token', walletAddress: WALLET_HTTP, acceptedTermsVersion: TERMS_VERSION },
    });
    check('the sign-up succeeds over HTTP', created.statusCode, 200);

    const httpUser = await prisma.user.findUnique({ where: { email: EMAIL_HTTP } });
    check('the account exists', Boolean(httpUser), true);
    const httpRows = httpUser ? await consentRows(httpUser.id) : [];
    check('exactly ONE consent row', httpRows.length, 1);
    check('naming the version in force', (httpRows[0]?.metadata as { termsVersion?: string })?.termsVersion, TERMS_VERSION);
    check('recorded against the account', httpRows[0]?.userId, httpUser?.id);

    // A SECOND sign-up with a different subject but the same address is a
    // returning identity: no account is created, so no second row.
    stub.verifyAuthToken = async () => ({ userId: DID_A });
    const again = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { token: 'stub-token', walletAddress: WALLET_HTTP, acceptedTermsVersion: TERMS_VERSION },
    });
    check('a second sign-up for the same address is accepted', again.statusCode, 200);
    check('and wrote no second consent row', httpUser ? (await consentRows(httpUser.id)).length : -1, 1);

    // A STALE client is refused by the route, with the typed code, and creates
    // nothing.
    stub.verifyAuthToken = async () => ({ userId: 'did:privy:check-consent-stale' });
    const staleHttp = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { token: 'stub-token', walletAddress: WALLET_HTTP, acceptedTermsVersion: '1999-01-01' },
    });
    check('a stale accepted version is refused over HTTP', staleHttp.statusCode, 409);
    check('with the typed code', staleHttp.json<Record<string, unknown>>().code, 'terms-version-stale');

    await app.close();
  }

  // ---------------------------------------------------------------------------
  // Cleanup, and proof the real users were left alone
  // ---------------------------------------------------------------------------
  await cleanup();
  check('no fixture user left behind', await prisma.user.count({ where: { email: { in: FIXTURE_EMAILS } } }), 0);
  check(
    'no consent row left behind for a fixture account',
    await prisma.auditLog.count({
      where: { action: 'user.consent-recorded', user: { email: { in: FIXTURE_EMAILS } } },
    }),
    0
  );
  check(
    'the real users are untouched',
    await prisma.user.count({ where: { email: { notIn: [...FIXTURE_EMAILS, 'dev@seti.test'] } } }),
    realUsersBefore
  );

  await prisma.$disconnect();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('consent check crashed:', error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
