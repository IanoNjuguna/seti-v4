/**
 * check:deploy-chain — the gate that refuses to call a deployment coherent when
 * the API on the box serves a different Tempo chain than the client was built for.
 *
 * Run with:  npm run check:deploy-chain    (part of `npm run verify`)
 *
 * The gate itself is `scripts/deploy-chain-gate.sh`, which the deploy concatenates
 * onto the remote script so the logic has exactly one copy on the box. This file
 * runs that same file as a CLI against a real HTTP server on a loopback port, so
 * every branch is proven here and not on a production deploy:
 *
 *   match            exit 0, and it prints the chain it confirmed
 *   mismatch         exit 1, and the message names BOTH chains
 *   no chainId       exit 1 (an API from before #200), never a pass
 *   empty expected   exit 1 without even asking the API
 *   no answer        exit 1 (the container stopped reporting)
 *
 * The last two are the ones a naive version gets wrong: a check whose input is
 * missing must fail closed, and a check that treats "no answer" as "no mismatch"
 * would have blessed exactly the outage it exists to catch.
 */
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const GATE = join(here, 'deploy-chain-gate.sh');

let failures = 0;
function check(label, passed, detail = '') {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/** One {status, body} the stub server answers with, swapped per case. */
let response = { status: 200, body: '{}' };
let requests = 0;

const server = createServer((request, reply) => {
  requests += 1;
  reply.writeHead(response.status, { 'content-type': 'application/json' });
  reply.end(response.body);
});

/**
 * Run the gate as the deploy does: as a script, with args, and read both streams.
 *
 * Asynchronous on purpose. `spawnSync` would block this process's event loop, and
 * the stub server above lives in the same process, so a synchronous child would
 * find every request timing out and prove the opposite of what it claims.
 */
function runGate(...args) {
  return new Promise((resolve) => {
    execFile('bash', [GATE, ...args], { encoding: 'utf8' }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, output: `${stdout}${stderr}` });
    });
  });
}

const BODY = (chainId) =>
  JSON.stringify({ status: 'ok', service: 'seti-api', version: '0.1.0', chainId, network: 'x', networkLabel: 'y' });

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/health`;

  // A deployment that agrees with itself.
  response = { status: 200, body: BODY(4217) };
  const match = await runGate(url, '4217');
  check('a coherent deployment passes', match.code === 0, `exit ${match.code}`);
  check(
    'and says which chain it confirmed',
    match.output.includes('chain coherence: the API serves 4217'),
    match.output.trim().split('\n').pop() ?? ''
  );

  // The case the whole thing exists for.
  response = { status: 200, body: BODY(42431) };
  const mismatch = await runGate(url, '4217');
  check('a mismatch fails the deploy', mismatch.code === 1, `exit ${mismatch.code}`);
  check(
    'and the message names both chains, so the fix is unambiguous',
    mismatch.output.includes('serves 42431') && mismatch.output.includes('built for 4217'),
    mismatch.output.slice(0, 140)
  );
  check(
    'and it says what to change',
    mismatch.output.includes('TEMPO_CHAIN_ID=4217') &&
      mismatch.output.includes('NEXT_PUBLIC_TEMPO_CHAIN_ID'),
    ''
  );

  // An API from before /health carried the chain: unreadable, therefore not proven.
  response = { status: 200, body: JSON.stringify({ status: 'ok', service: 'seti-api' }) };
  const noField = await runGate(url, '4217');
  check('an API that does not report its chain fails', noField.code === 1, `exit ${noField.code}`);
  check('and says the chain is unknown', noField.output.includes('without a chainId'), '');

  // Fail closed on a missing expectation, without asking the API at all: a check
  // whose input is absent must not silently pass.
  const before = requests;
  const noExpectation = await runGate(url, '');
  check('an empty expected chain fails', noExpectation.code === 1, `exit ${noExpectation.code}`);
  check(
    'and it does not bother asking the API',
    requests === before,
    `${requests - before} request(s)`
  );
  check(
    'and names the variable an operator has to set',
    noExpectation.output.includes('NEXT_PUBLIC_TEMPO_CHAIN_ID'),
    ''
  );

  // The container answered liveness and then stopped reporting.
  const silent = await runGate('http://127.0.0.1:1/health', '4217');
  check('an API that does not answer fails', silent.code === 1, `exit ${silent.code}`);
  check('and says the chain is unknown rather than matching', silent.output.includes('did not answer'), '');

  server.close();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
});
