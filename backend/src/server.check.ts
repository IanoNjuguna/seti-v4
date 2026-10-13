/**
 * Server-level request-error checks.
 *
 * Run with:  npm run check:server
 * Requires:  docker compose up -d  (the `seti-postgres` container) — the claim
 *            cases authenticate through the dev bypass, which resolves
 *            `dev@seti.test` in the database.
 *
 * The bug this pins: a claim body that is well-formed JSON but not the shape the
 * route expects (a missing field, `null`, an array) reached the global handler
 * and came back as `500 { code: 'INTERNAL_ERROR' }` — the server blaming itself
 * for the client's mistake. A malformed request is the client's fault and must
 * be a typed 400; a genuine fault inside a handler is the server's and must stay
 * a 500. The 500 case below is the load-bearing one: it proves the fix narrows
 * the handler to actual client-shape errors rather than widening a catch.
 *
 * The claim cases run against the REAL server (`buildServer`), so they exercise
 * the handler the server actually installs. The fault case needs a route that
 * throws, which no shipped route does, so it runs against a minimal app built
 * from the same exported `apiErrorHandler`.
 */
import Fastify from 'fastify';
import { buildServer, apiErrorHandler, INVALID_REQUEST_BODY } from './server.js';

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

interface Envelope {
  code?: string;
  error?: string;
}

async function main() {
  const server = await buildServer();

  // -------------------------------------------------------------------------
  // A badly-shaped claim body is the client's fault: a typed 400, never a 500
  // -------------------------------------------------------------------------
  console.log('a malformed claim body is the client\u2019s fault:');

  const notObject = await server.inject({
    method: 'POST',
    url: '/handles/claim',
    payload: { kind: 'person' },
  });
  const notObjectBody = notObject.json<Envelope>();
  check('a claim body missing its fields is a 400', notObject.statusCode === 400, `got ${notObject.statusCode}`);
  check('...with the typed code', notObjectBody.code === INVALID_REQUEST_BODY, `code=${notObjectBody.code}`);

  const nullBody = await server.inject({
    method: 'POST',
    url: '/handles/claim',
    headers: { 'content-type': 'application/json' },
    payload: 'null',
  });
  const nullEnvelope = nullBody.json<Envelope>();
  check('a JSON null claim body is a 400', nullBody.statusCode === 400, `got ${nullBody.statusCode}`);
  check('...with the typed code', nullEnvelope.code === INVALID_REQUEST_BODY, `code=${nullEnvelope.code}`);

  const arrayBody = await server.inject({
    method: 'POST',
    url: '/handles/claim',
    payload: [] as unknown as Record<string, unknown>,
  });
  check('a JSON array claim body is a 400', arrayBody.statusCode === 400, `got ${arrayBody.statusCode}`);

  const nonJson = await server.inject({
    method: 'POST',
    url: '/handles/claim',
    headers: { 'content-type': 'application/json' },
    payload: 'this is not JSON {',
  });
  const nonJsonEnvelope = nonJson.json<Envelope>();
  check('a non-JSON claim body is a 400', nonJson.statusCode === 400, `got ${nonJson.statusCode}`);
  check('...with the typed code', nonJsonEnvelope.code === INVALID_REQUEST_BODY, `code=${nonJsonEnvelope.code}`);

  // A well-shaped body still reaches the route's own validation, so the 400s
  // above are the SHAPE check rejecting input — not auth or routing rejecting
  // everything. `x` fails the name rule, which is a different typed 400.
  const shaped = await server.inject({
    method: 'POST',
    url: '/handles/claim',
    payload: {
      kind: 'person',
      name: 'x',
      address: '0x0000000000000000000000000000000000000000',
      issuedAt: '1970-01-01T00:00:00.000Z',
      nonce: 'n',
      signature: '0x0',
    },
  });
  const shapedEnvelope = shaped.json<Envelope>();
  check(
    'a well-shaped but invalid claim still reaches the route',
    shaped.statusCode === 400 && shapedEnvelope.code !== INVALID_REQUEST_BODY,
    `got ${shaped.statusCode} code=${shapedEnvelope.code}`
  );

  await server.close();

  // -------------------------------------------------------------------------
  // A genuine server fault is STILL a 500 — the fix is not a widened catch
  // -------------------------------------------------------------------------
  console.log('\na genuine server fault is still a 500:');

  const probe = Fastify();
  probe.setErrorHandler(apiErrorHandler);
  probe.get('/fault', async () => {
    throw new Error('simulated server fault');
  });
  probe.get('/client-fault', async () => {
    throw Object.assign(new Error('you asked for something impossible'), {
      statusCode: 400,
      code: 'bad-request',
    });
  });
  await probe.ready();

  const fault = await probe.inject({ method: 'GET', url: '/fault' });
  const faultEnvelope = fault.json<Envelope>();
  check('a thrown server fault stays a 500', fault.statusCode === 500, `got ${fault.statusCode}`);
  check('...with INTERNAL_ERROR', faultEnvelope.code === 'INTERNAL_ERROR', `code=${faultEnvelope.code}`);
  check('...and is NOT relabelled as a client error', faultEnvelope.code !== INVALID_REQUEST_BODY);

  const clientFault = await probe.inject({ method: 'GET', url: '/client-fault' });
  const clientFaultEnvelope = clientFault.json<Envelope>();
  check(
    "a handler's own 4xx passes through unchanged",
    clientFault.statusCode === 400 && clientFaultEnvelope.code === 'bad-request',
    `got ${clientFault.statusCode} code=${clientFaultEnvelope.code}`
  );

  await probe.close();

  console.log('-'.repeat(72));
  if (failures > 0) {
    console.log(`${failures} CHECK(S) FAILED.`);
    process.exit(1);
  }
  console.log(`${total} assertions passed.`);
}

main().catch((error) => {
  console.error('server error-handling check crashed:', error);
  process.exit(1);
});
