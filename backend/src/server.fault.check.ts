/**
 * Internal-fault checks: a driver error must never reach the client.
 *
 * Run with:  npm run check:fault    (part of `npm run verify`)
 * Requires:  the database on `DATABASE_URL` — the forced fault is a REAL Prisma
 *            query, not a simulated throw, because the bug it pins was a real
 *            driver error reaching a real person.
 *
 * The fault the owner hit, quoted from the sign-in UI:
 *
 *   Invalid `prisma.user.findUnique()` invocation in backend/src/routes/auth.ts:48
 *   … The column `users.network` does not exist in the current database.
 *
 * That is the database's own vocabulary — a schema fact, a source path, a SQL
 * error code — handed to a person trying to sign in. Two things were wrong: the
 * API echoed the driver's message, and the client had nothing better to show.
 * This suite owns the first half, and it drives the fault through the REAL
 * server (`buildServer`) so it exercises the handler the server actually
 * installs, the request id it actually mints, and the log line it actually
 * writes.
 *
 * It asserts BOTH halves of the fix, so it cannot be satisfied by swallowing
 * faults:
 *
 *   1. the client body is a stable typed code and one plain sentence, carrying
 *      none of the driver's vocabulary (`prisma`, `invocation`, `column`, `P2`,
 *      `postgres`);
 *   2. the server log carries the SAME request id the client was shown, plus the
 *      full driver detail — so the sentence a user reports resolves to the exact
 *      fault, and nothing is lost;
 *   3. a genuine throw still returns 500 (`INTERNAL_ERROR`), and the documented
 *      typed 400 mappings are untouched.
 */
import Fastify from 'fastify';
import { PassThrough } from 'node:stream';
import { ZodError } from 'zod';
import { prisma } from './lib/prisma.js';
import {
  buildServer,
  apiErrorHandler,
  INTERNAL_ERROR,
  INTERNAL_ERROR_MESSAGE,
  INVALID_REQUEST_BODY,
  REQUEST_ID_HEADER,
} from './server.js';

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

interface Envelope {
  error?: string;
  code?: string;
  requestId?: string;
}

/** Words that belong to a database driver and must never reach a client. */
const DRIVER_VOCABULARY = ['prisma', 'invocation', 'column', 'p2', 'postgres'];

/** The column name this check asks for and the database does not have. */
const MISSING_COLUMN = 'seti_fault_check_missing_column';

/** Poll a log sink until `predicate` holds, so a line still in flight is seen. */
async function waitForLog(predicate: () => boolean, timeoutMs = 3000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return predicate();
}

async function main() {
  // -------------------------------------------------------------------------
  // FORCE the fault: a query against a column that does not exist
  // -------------------------------------------------------------------------
  // The real server, with a log sink attached so the check can read exactly what
  // the server writes, and one extra route that runs a real Prisma query. This
  // is the owner's fault reproduced: Prisma raises a `P2xxx` driver error whose
  // message contains the table, the column and the SQL code.
  const log = new PassThrough();
  let logText = '';
  log.on('data', (chunk: Buffer) => {
    logText += chunk.toString();
  });

  const server = await buildServer({ logger: { level: 'info', stream: log } });
  server.get('/__internal-fault', async () => {
    await prisma.$queryRawUnsafe(`SELECT "${MISSING_COLUMN}" FROM "users" LIMIT 1`);
    return { unreachable: true };
  });

  const fault = await server.inject({ method: 'GET', url: '/__internal-fault' });
  const faultBody = fault.json<Envelope>();
  const faultText = fault.body;

  console.log('a forced driver fault reaches the client as a plain sentence:');

  check('the fault is a 500', fault.statusCode === 500, `got ${fault.statusCode}`);
  check('...with the stable typed code', faultBody.code === INTERNAL_ERROR, `code=${faultBody.code}`);
  check(
    '...and one plain human sentence, not the driver text',
    faultBody.error === INTERNAL_ERROR_MESSAGE,
    `error=${JSON.stringify(faultBody.error)}`
  );

  const leaked = DRIVER_VOCABULARY.filter((word) => faultText.toLowerCase().includes(word));
  check('the client body leaks no driver vocabulary', leaked.length === 0, `leaked=${leaked.join(',')}`);

  check(
    'the client body carries a request id',
    typeof faultBody.requestId === 'string' && faultBody.requestId.length > 0,
    `requestId=${String(faultBody.requestId)}`
  );
  check(
    '...and the same id on the x-request-id header',
    fault.headers[REQUEST_ID_HEADER] === faultBody.requestId,
    `header=${String(fault.headers[REQUEST_ID_HEADER])}`
  );

  // The other half: the detail is NOT lost — it is logged against that id.
  const requestId = String(faultBody.requestId);
  const hasLogLine = await waitForLog(() => logText.includes(requestId));
  const logLines = logText.split('\n').filter((line) => line.includes(requestId));

  check('the server log carries the request id', hasLogLine, `id=${requestId}`);
  check(
    '...in a line that also carries the full driver detail',
    logLines.some((line) => line.includes('does not exist') && line.includes(MISSING_COLUMN)),
    'no line has the column detail'
  );
  // The driver vocabulary the client was spared is PRESENT server-side — proof
  // the fault really fired and the detail was preserved, not simply never made.
  check(
    '...including driver vocabulary the client never saw',
    logLines.some((line) => line.toLowerCase().includes('prisma')),
    'log line has no prisma detail'
  );

  await server.close();

  // -------------------------------------------------------------------------
  // A genuine throw is STILL a 500 — the fix is not a swallowed fault
  // -------------------------------------------------------------------------
  // This is the load-bearing negative: if the handler caught and hid everything,
  // the assertions above would pass and nothing would ever be a server error.
  console.log('\na genuine server fault is still a 500:');

  const probe = Fastify();
  probe.setErrorHandler(apiErrorHandler);
  probe.get('/plain-fault', async () => {
    throw new Error('simulated server fault');
  });
  probe.get('/typed-4xx', async () => {
    throw Object.assign(new Error('a client-actionable refusal'), {
      statusCode: 409,
      code: 'handle-taken',
    });
  });
  probe.get('/shape-fault', async () => {
    throw new ZodError([]);
  });
  await probe.ready();

  const plain = await probe.inject({ method: 'GET', url: '/plain-fault' });
  const plainBody = plain.json<Envelope>();
  check('a thrown fault stays a 500', plain.statusCode === 500, `got ${plain.statusCode}`);
  check('...with INTERNAL_ERROR', plainBody.code === INTERNAL_ERROR, `code=${plainBody.code}`);
  check(
    '...and does not echo the thrown message',
    plainBody.error === INTERNAL_ERROR_MESSAGE,
    `error=${JSON.stringify(plainBody.error)}`
  );

  // A handler's OWN typed 4xx passes through with its code and copy untouched —
  // the fix narrows nothing that was deliberate.
  const typed = await probe.inject({ method: 'GET', url: '/typed-4xx' });
  const typedBody = typed.json<Envelope>();
  check(
    "a handler's own typed 4xx passes through unchanged",
    typed.statusCode === 409 && typedBody.code === 'handle-taken' && typedBody.error === 'a client-actionable refusal',
    `got ${typed.statusCode} code=${typedBody.code}`
  );

  // The documented 400 mapping is untouched: a ZodError is still a typed 400.
  const shape = await probe.inject({ method: 'GET', url: '/shape-fault' });
  const shapeBody = shape.json<Envelope>();
  check(
    'a ZodError is still the typed 400',
    shape.statusCode === 400 && shapeBody.code === INVALID_REQUEST_BODY,
    `got ${shape.statusCode} code=${shapeBody.code}`
  );

  await probe.close();
  await prisma.$disconnect();

  console.log('-'.repeat(72));
  if (failures > 0) {
    console.log(`${failures} CHECK(S) FAILED.`);
    process.exit(1);
  }
  console.log(`${total} assertions passed.`);
}

main().catch(async (error) => {
  console.error('internal-fault check crashed:', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
