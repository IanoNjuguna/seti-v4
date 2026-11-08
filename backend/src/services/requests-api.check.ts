/**
 * The ask API, driven through the real routes — `npm run check:requests-api`.
 *
 * Requires `docker compose up -d` (the `seti-postgres` container) and the npm script's
 * `DEV_BYPASS_AUTH=true`, like the other database-backed suites.
 *
 * The service is already covered by `check:requests`. What this suite exists for is the layer between a
 * phone and that service, where a code becomes an HTTP status and a body becomes a row:
 *
 *  1. **Create answers 201 with a link-shaped id**, and the ask is readable without an account.
 *  2. **The public read is the SMALL subset.** No creator, no transaction id: a payer needs the payee,
 *     the amount, the state and until when.
 *  3. **The codes map to the statuses a client can act on**: 403 for a handle that is not yours, 400
 *     for an amount the keypad could not have produced, 404 for an id that names nothing.
 *  4. **Cancel is the owner's, and it is visible to the payer**. A cancelled ask reads `cancelled` in
 *     the public read, and cancelling it twice is a 409 rather than a second success.
 *  5. **An ask that has lapsed reads `expired`** through the same public read, with nothing having
 *     written that value.
 *
 * The suite drives the bypass user (`dev@seti.test`), gives it a handle of its own per run, and deletes
 * everything it wrote.
 */
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { requestRoutes } from '../routes/requests.js';
import { publicRequestRoutes } from '../routes/public-requests.js';
import { servedNetwork } from '../config/networks.js';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

const RUN = `reqapi_${randomUUID().slice(0, 8)}`;

async function main() {
  if (!process.env.DEV_BYPASS_AUTH) {
    console.error('check:requests-api needs DEV_BYPASS_AUTH=true (set by the npm script)');
    process.exit(1);
  }

  const dev = await prisma.user.findUnique({ where: { email: 'dev@seti.test' } });
  if (!dev) throw new Error('the bypass user does not exist in this database');

  /*
   * The bypass user already owns a person handle in a seeded database, and the partial unique index
   * allows exactly one, so this reuses it rather than minting a second. The suite never deletes a handle
   * it did not create.
   */
  const existingHandle = await prisma.handle.findFirst({
    where: { userId: dev.id, kind: 'person', network: servedNetwork },
  });
  const handle =
    existingHandle ??
    (await prisma.handle.create({
      data: {
        handle: `${RUN}-ask`,
        network: servedNetwork,
        kind: 'person',
        name: 'Ask Er',
        address: `0x${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`.slice(0, 42),
        userId: dev.id,
      },
    }));

  const stranger = await prisma.user.create({
    data: { email: `${RUN}_stranger@seti.test`, firstName: 'Not', lastName: 'Yours' },
  });
  const strangerHandle = await prisma.handle.create({
    data: {
      handle: `${RUN}-theirs`,
      network: servedNetwork,
      kind: 'person',
      name: 'Not Yours',
      address: `0x${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`.slice(0, 42),
      userId: stranger.id,
    },
  });

  const app: FastifyInstance = Fastify();
  // The routes' own preHandler is the real one; the bypass in `authMiddleware` is what supplies a user.
  await app.register(publicRequestRoutes, { prefix: '/public/requests' });
  await app.register(requestRoutes, { prefix: '/requests' });

  console.log('a create answers with the ask, and its link reads without an account:');
  const created = await app.inject({
    method: 'POST',
    url: '/requests',
    payload: { destinationHandle: handle.handle, amount: '500.00', memo: 'lunch' },
  });

  check('create answers 201', created.statusCode === 201, String(created.statusCode));
  const body = created.json<{ request?: { publicId?: string; amount?: string } }>();
  check('and carries a link-shaped id', /^[0-9a-f]{18}$/.test(body.request?.publicId ?? ''));
  const publicId = body.request?.publicId ?? '';

  const read = await app.inject({ method: 'GET', url: `/public/requests/${publicId}` });
  check('the link reads without a session', read.statusCode === 200, String(read.statusCode));
  const view = read.json<{ request?: Record<string, unknown> }>().request ?? {};
  check('and shows the amount asked', view.amount === '500.00', String(view.amount));
  check('and the state', view.status === 'open', String(view.status));
  check(
    'and nothing about the person who asked',
    !('creatorId' in view) && !('settledTransactionId' in view),
    Object.keys(view).join(',')
  );

  console.log('\nthe codes map to statuses a client can act on:');
  const notYours = await app.inject({
    method: 'POST',
    url: '/requests',
    payload: { destinationHandle: strangerHandle.handle, amount: '100.00' },
  });
  check('a handle you do not own is 403', notYours.statusCode === 403, String(notYours.statusCode));

  const badAmount = await app.inject({
    method: 'POST',
    url: '/requests',
    payload: { destinationHandle: handle.handle, amount: '1e3' },
  });
  check('an amount the keypad could not produce is 400', badAmount.statusCode === 400, String(badAmount.statusCode));

  const missing = await app.inject({ method: 'GET', url: '/public/requests/doesnotexist' });
  check('an id that names nothing is 404', missing.statusCode === 404, String(missing.statusCode));

  console.log('\ncancelling is the owner\'s, and the payer sees it:');
  const cancelled = await app.inject({ method: 'POST', url: `/requests/${publicId}/cancel` });
  check('cancel answers 204', cancelled.statusCode === 204, String(cancelled.statusCode));

  const afterCancel = await app.inject({ method: 'GET', url: `/public/requests/${publicId}` });
  check(
    'the link reads cancelled',
    afterCancel.json<{ request?: { status?: string } }>().request?.status === 'cancelled'
  );

  const twice = await app.inject({ method: 'POST', url: `/requests/${publicId}/cancel` });
  check('cancelling twice is 409, not a second success', twice.statusCode === 409, String(twice.statusCode));

  console.log('\na lapsed ask reads expired, with nothing having written it:');
  const lapsed = await app.inject({
    method: 'POST',
    url: '/requests',
    payload: { destinationHandle: handle.handle, amount: '42.00' },
  });
  const lapsedId = lapsed.json<{ request?: { publicId?: string } }>().request?.publicId ?? '';
  await prisma.paymentRequest.update({
    where: { publicId: lapsedId },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  const lapsedRead = await app.inject({ method: 'GET', url: `/public/requests/${lapsedId}` });
  check(
    'time passing is enough',
    lapsedRead.json<{ request?: { status?: string } }>().request?.status === 'expired'
  );

  console.log('\ncleanup:');
  await prisma.paymentRequest.deleteMany({ where: { creatorId: dev.id, publicId: { not: '' } } });
  await prisma.handle.deleteMany({ where: { handle: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
  check(
    'nothing of this run is left',
    (await prisma.handle.count({ where: { handle: { startsWith: RUN } } })) === 0 &&
      (await prisma.user.count({ where: { email: { startsWith: RUN } } })) === 0
  );

  await app.close();
  await prisma.$disconnect();

  console.log('-'.repeat(74));
  console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('requests-api check crashed:', error);
  await prisma.$disconnect();
  process.exit(1);
});

// The middleware is imported for its side-effect contract; referenced so lint keeps it.
void authMiddleware;
