/**
 * The session identity checks: a live session must resolve by the identity it was
 * ESTABLISHED with, not by an attribute re-read at request time.
 *
 * Run with:  npm run check:session        (the script sets DEV_BYPASS_AUTH=true)
 * Requires:  docker compose up -d  (the `seti-postgres` container)
 *
 * Why this exists: `middleware/auth.ts` used to answer "who is this request?" by
 * re-resolving the local account from the email Privy reports NOW, on every
 * request. The email is the ENTRY key at login and a mutable attribute, so a
 * change to it after a session was established re-pointed — or killed — that
 * session, and the history recorded under it appeared to belong to whoever holds
 * the email afterwards. The account is now bound to the Privy SUBJECT (the DID)
 * at establishment and resolved from that binding, and this suite pins the
 * policy:
 *
 *   - a subject resolves to the account bound to it, and to no other;
 *   - an email is NOT a key — passing an account's own email resolves nothing;
 *   - a later change to an account's email does not move the identity;
 *   - an unknown or missing subject refuses, with the typed code, and never
 *     falls back to an email lookup;
 *   - a subject already bound to another account cannot be taken over.
 *
 * The HTTP cases below pin the half the middleware must NOT break while doing
 * this: the development bypass resolves without a token, and it remains a
 * FALLBACK — a request carrying something that looks like a real token is
 * verified for real rather than swallowed by the bypass.
 *
 * IMPORTANT: every row this file touches belongs to a fixture user
 * (`check-session-*@seti.test`, DIDs `did:privy:check-session-*`). The real users
 * are snapshotted and checked unchanged — a user row is where a ledger hangs.
 */
import Fastify from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from './auth.js';
import { AUTH_UNAUTHORIZED_MESSAGE } from '../services/auth.js';
import {
  SESSION_IDENTITY_UNKNOWN,
  bindSessionIdentity,
  resolveSessionIdentity,
} from '../services/session-identity.js';

const EMAIL_A = 'check-session-a@seti.test';
const EMAIL_B = 'check-session-b@seti.test';
const EMAIL_C = 'check-session-c@seti.test';
const DID_A = 'did:privy:check-session-a';
const DID_B = 'did:privy:check-session-b';
const DID_C = 'did:privy:check-session-c';
const FIXTURE_EMAILS = [EMAIL_A, EMAIL_B, EMAIL_C];
const FIXTURE_DIDS = [DID_A, DID_B, DID_C];

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ email: { in: FIXTURE_EMAILS } }, { privyDid: { in: FIXTURE_DIDS } }],
    },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  if (ids.length > 0) {
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

/** The `id` a resolution returned, or a marker the assertion can see. */
function resolvedId(
  outcome: Awaited<ReturnType<typeof resolveSessionIdentity>>
): string {
  return 'code' in outcome ? `refused:${outcome.code}` : outcome.id;
}

async function main() {
  // Snapshot the real users so the check can prove it left them alone.
  const realBefore = await prisma.user.count({
    where: { email: { notIn: [...FIXTURE_EMAILS, 'dev@seti.test'] } },
  });

  await cleanup();

  const userA = await prisma.user.create({ data: { email: EMAIL_A, privyDid: DID_A } });
  const userB = await prisma.user.create({ data: { email: EMAIL_B, privyDid: DID_B } });
  // A legacy row: no Privy identity, exactly like an account that predates the
  // binding column. It must stay reachable by nothing but a fresh login.
  const userC = await prisma.user.create({ data: { email: EMAIL_C } });

  // ---------------------------------------------------------------------------
  // A subject resolves to the account bound to it — and only that one
  // ---------------------------------------------------------------------------
  console.log('a session resolves by the subject it was established with:');

  check(
    'a bound subject resolves to its account',
    resolvedId(await resolveSessionIdentity(DID_A)) === userA.id
  );
  check(
    'a different subject resolves to a different account',
    resolvedId(await resolveSessionIdentity(DID_B)) === userB.id
  );

  // ---------------------------------------------------------------------------
  // An email is NOT a key — the whole point of the change
  // ---------------------------------------------------------------------------
  console.log('\nan email does not identify a session:');

  check(
    "an account's OWN email resolves nothing",
    resolvedId(await resolveSessionIdentity(EMAIL_A)) === `refused:${SESSION_IDENTITY_UNKNOWN}`,
    `got ${resolvedId(await resolveSessionIdentity(EMAIL_A))}`
  );
  check(
    'a missing subject refuses with the typed code',
    resolvedId(await resolveSessionIdentity(undefined)) === `refused:${SESSION_IDENTITY_UNKNOWN}`
  );
  check(
    'an unknown subject refuses with the typed code',
    resolvedId(await resolveSessionIdentity('did:privy:unknown')) ===
      `refused:${SESSION_IDENTITY_UNKNOWN}`
  );
  check(
    'a legacy account with no binding is not reachable by subject',
    resolvedId(await resolveSessionIdentity(DID_C)) === `refused:${SESSION_IDENTITY_UNKNOWN}`
  );

  // ---------------------------------------------------------------------------
  // A later change does not move an established identity
  // ---------------------------------------------------------------------------
  console.log('\na later change to the account does not re-point the session:');

  await prisma.user.update({ where: { id: userA.id }, data: { email: 'check-session-a2@seti.test' } });

  check(
    'the identity is still the account bound to the subject',
    resolvedId(await resolveSessionIdentity(DID_A)) === userA.id
  );
  check(
    'and the new email is still not a key',
    resolvedId(await resolveSessionIdentity('check-session-a2@seti.test')) ===
      `refused:${SESSION_IDENTITY_UNKNOWN}`
  );

  // ---------------------------------------------------------------------------
  // Binding: idempotent for the owner, refused for anyone else
  // ---------------------------------------------------------------------------
  console.log('\nbinding a subject is idempotent for its owner and refused for another account:');

  const bindLegacy = await bindSessionIdentity(userC.id, DID_C);
  check('an unbound account can be bound', bindLegacy.ok);
  check(
    'and it then resolves by its subject',
    resolvedId(await resolveSessionIdentity(DID_C)) === userC.id
  );

  const rebind = await bindSessionIdentity(userA.id, DID_A);
  check('re-binding the same subject to its owner is a no-op success', rebind.ok);

  const steal = await bindSessionIdentity(userB.id, DID_A);
  check("another account cannot take a bound subject", steal.ok === false);
  check(
    'and the subject still belongs to its owner',
    resolvedId(await resolveSessionIdentity(DID_A)) === userA.id
  );

  // ---------------------------------------------------------------------------
  // HTTP: the dev bypass still works, and is still only a fallback
  // ---------------------------------------------------------------------------
  console.log('\nthe dev bypass still resolves, and is still a fallback:');

  const app = Fastify();
  app.get('/whoami', { preHandler: authMiddleware }, async (request) => ({
    user: request.user ?? null,
  }));
  await app.ready();

  const bypassed = await app.inject({ method: 'GET', url: '/whoami' });
  const bypassedBody = bypassed.json<{ user: { email?: string } | null }>();
  check(
    'a request with no token resolves as the dev user',
    bypassed.statusCode === 200 && bypassedBody.user?.email === 'dev@seti.test',
    `got ${bypassed.statusCode} ${JSON.stringify(bypassedBody.user)}`
  );

  const devToken = await app.inject({
    method: 'GET',
    url: '/whoami',
    headers: { authorization: 'Bearer dev-bypass-token' },
  });
  check(
    'the non-JWT dev token still resolves as the dev user',
    devToken.statusCode === 200,
    `got ${devToken.statusCode}`
  );

  const realLooking = await app.inject({
    method: 'GET',
    url: '/whoami',
    headers: { authorization: 'Bearer aaa.bbb.ccc' },
  });
  check(
    'a JWT-shaped token is verified for real, not swallowed by the bypass',
    realLooking.statusCode === 401,
    `got ${realLooking.statusCode}`
  );

  // The refusal carries its CODE, which is what the web app reads (#284). A 401
  // whose body has only `error` renders as the unknown-failure sentence there, so
  // the customer was told "Try again in a moment. It was cleared, sign in again."
  // instead of "Your session ended. Sign in again." — one sentence, one action.
  const refusedBody = realLooking.json<{ error?: string; code?: string }>();
  check(
    'a refused bearer answers with the unauthorized code',
    refusedBody.code === 'unauthorized',
    `got ${JSON.stringify(refusedBody)}`
  );
  check(
    "the body is the sentence services/auth.ts declares, not the SDK's",
    refusedBody.error === AUTH_UNAUTHORIZED_MESSAGE,
    String(refusedBody.error)
  );

  await app.close();

  await cleanup();

  const realAfter = await prisma.user.count({
    where: { email: { notIn: [...FIXTURE_EMAILS, 'dev@seti.test'] } },
  });
  check('real users were not touched', realAfter === realBefore);

  await prisma.$disconnect();

  console.log('-'.repeat(72));
  if (failures > 0) {
    console.log(`${failures} CHECK(S) FAILED.`);
    process.exit(1);
  }
  console.log(`${total} assertions passed.`);
}

main().catch(async (error) => {
  console.error('session check crashed:', error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
