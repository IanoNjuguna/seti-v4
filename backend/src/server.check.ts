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
 * The same mistake, in the same request, on the other field: `POST /auth/verify`
 * let a Privy verification failure escape as an untyped throw, so a token the
 * server simply could not verify came back as `500 INTERNAL_ERROR` — "Seti had a
 * problem on our side, and nothing was changed" — on EVERY sign-in. A refused
 * token is the client's failure and must be a typed 401; that case is pinned
 * here too, against the real route, and the mapping itself is pinned through the
 * shared handler with no credentials and no database (so CI proves it as well).
 *
 * The claim cases run against the REAL server (`buildServer`), so they exercise
 * the handler the server actually installs. The fault case needs a route that
 * throws, which no shipped route does, so it runs against a minimal app built
 * from the same exported `apiErrorHandler`.
 */
import Fastify from 'fastify';
import { buildServer, apiErrorHandler, INTERNAL_ERROR, INTERNAL_ERROR_MESSAGE, INVALID_REQUEST_BODY } from './server.js';
import {
  AUTH_UNAUTHORIZED,
  AUTH_UNAUTHORIZED_MESSAGE,
  PrivyTokenVerificationError,
  isPrivyConfigured,
} from './services/auth.js';

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
  // A token the server cannot verify is the CALLER's failure: a typed 401
  // -------------------------------------------------------------------------
  // The bug this pins, quoted from the sign-in UI: "Seti had a problem on our
  // side, and nothing was changed." `POST /auth/verify` let the verification
  // failure escape as an untyped throw, so the shared handler reported it as a
  // fault — a 500 `INTERNAL_ERROR` for a token that was simply wrong. EVERY
  // sign-in failed that way: the sentence a person read said Seti was broken
  // when the only thing wrong was the token they presented.
  console.log('\na token that cannot be verified is not a server fault:');

  const bogusServer = await buildServer();
  const bogus = await bogusServer.inject({
    method: 'POST',
    url: '/auth/verify',
    payload: { token: 'bogus-token-for-diagnosis' },
  });
  const bogusBody = bogus.json<Envelope>();
  await bogusServer.close();

  check(
    'a bogus Privy token is never reported as a server fault',
    bogus.statusCode !== 500 && bogusBody.code !== INTERNAL_ERROR,
    `got ${bogus.statusCode} code=${bogusBody.code}`
  );
  check(
    '...and never the server-fault sentence',
    bogusBody.error !== INTERNAL_ERROR_MESSAGE,
    `error=${JSON.stringify(bogusBody.error)}`
  );

  if (isPrivyConfigured()) {
    // Only where THIS box has Privy credentials, because that is the only place
    // a token can actually be put to Privy. A box without them refuses earlier
    // and by name, which is the correct behaviour rather than a weaker version
    // of this one — so the branch below asserts that instead of pretending.
    check('...it is a 401, the client\u2019s failure', bogus.statusCode === 401, `got ${bogus.statusCode}`);
    check(
      '...with the refusal code the web app already knows',
      bogusBody.code === AUTH_UNAUTHORIZED,
      `code=${bogusBody.code}`
    );
    check(
      '...and one authored sentence',
      bogusBody.error === AUTH_UNAUTHORIZED_MESSAGE,
      `error=${JSON.stringify(bogusBody.error)}`
    );
    // A stale session is not something to retry with the same token, and the web
    // app decides that from the code alone (`web/lib/api/refusal.ts`).
    check('...which is the code the app treats as not retryable', bogusBody.code === 'unauthorized');
  } else {
    check(
      '...a box with no Privy credentials refuses sign-in by name',
      bogus.statusCode === 503,
      `got ${bogus.statusCode}`
    );
  }

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
  // The refusal the verification path raises, left UNCAUGHT on purpose: even a
  // caller that forgets to map it cannot turn a refused token into an
  // INTERNAL_ERROR, because the refusal carries its own 401 and typed code. This
  // case needs no Privy credentials and no database, so the mapping is pinned on
  // every box — CI included.
  probe.get('/refused-token', async () => {
    throw new PrivyTokenVerificationError(
      'Invalid Compact JWS',
      Object.assign(new Error('Invalid Compact JWS'), { code: 'ERR_JWS_INVALID' })
    );
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

  // The refusal the verification path raises, driven through the SAME handler.
  const refused = await probe.inject({ method: 'GET', url: '/refused-token' });
  const refusedEnvelope = refused.json<Envelope>();
  check(
    'an uncaught token refusal is a 401 unauthorized, not a 500',
    refused.statusCode === 401 && refusedEnvelope.code === AUTH_UNAUTHORIZED,
    `got ${refused.statusCode} code=${refusedEnvelope.code}`
  );
  check(
    '...and hands the client the authored sentence, not the SDK\u2019s',
    refusedEnvelope.error === AUTH_UNAUTHORIZED_MESSAGE && !refused.body.includes('JWS'),
    `error=${JSON.stringify(refusedEnvelope.error)}`
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
