/**
 * RPC ⇄ network coherence guard checks.
 *
 * Run with:  npm run check:rpc-guard
 * Requires:  NOTHING — no network, no database, no secrets.
 *
 * Two halves, both decidable offline:
 *
 *   (a) the STATIC decision (`config/rpc-coherence.ts`) — driven directly, so
 *       every branch is pinned, including the shapes a running box cannot
 *       produce for itself (a shared endpoint, a legacy pair naming the other
 *       chain). This is tonight's incident as an assertion.
 *
 *   (b) the RUNTIME chain-id guard (`services/chain.ts`) — proved by spawning a
 *       probe whose SERVED endpoint is a LOCAL STUB that reports the wrong chain
 *       id. The refusal is demonstrated against a stub rather than by breaking a
 *       real endpoint, and the stub counts its `eth_chainId` calls so the check
 *       proves the verdict is cached (one call, not one per request).
 *
 * The probe is spawned with a controlled environment in a working directory
 * OUTSIDE `backend/`, so this check never reads the box's own `.env` and never
 * depends on what the box happens to serve.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  evaluateRpcCoherence,
  IncoherentRpcConfigError,
  maskEndpoint,
  networkForEndpoint,
  type RpcCoherenceInput,
} from './rpc-coherence.js';
import { TEMPO_MAINNET_CHAIN_ID, TEMPO_TESTNET_CHAIN_ID } from '../lib/network.js';

const here = __dirname;
const probePath = join(here, 'rpc-chain-probe.ts');
const tsxCli = require.resolve('tsx/cli');
const neutralCwd = mkdtempSync(join(tmpdir(), 'seti-rpc-guard-'));

let total = 0;
let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  total += 1;
  const passed = actual === expected;
  if (!passed) failures += 1;
  console.log(
    `${passed ? 'ok  ' : 'FAIL'}  ${label}` +
      (passed ? '' : `  expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`)
  );
}

function checkTrue(label: string, actual: unknown): void {
  total += 1;
  const passed = actual === true;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${passed ? '' : `  actual=${JSON.stringify(actual)}`}`);
}

// ---------------------------------------------------------------------------
// (a) the pure coherence decision
// ---------------------------------------------------------------------------
console.log('(a) endpoint classification and the pure coherence decision:');

check('a Moderato host is the testnet network', networkForEndpoint('https://rpc.moderato.tempo.xyz'), 'testnet');
check('the canonical mainnet host is the mainnet network', networkForEndpoint('https://rpc.tempo.xyz'), 'mainnet');
check(
  'an Alchemy mainnet host classifies without a table entry',
  networkForEndpoint('https://tempo-mainnet.g.alchemy.com/v2/key'),
  'mainnet'
);
check(
  'an Alchemy Moderato host classifies without a table entry',
  networkForEndpoint('https://tempo-moderato.g.alchemy.com/v2/key'),
  'testnet'
);
check('an unknown host is reported as unknown, not guessed', networkForEndpoint('https://rpc.example.io'), null);
check('a host that says BOTH is refused as ambiguous', networkForEndpoint('https://mainnet.testnet.example'), null);
check('a missing endpoint is unknown', networkForEndpoint(undefined), null);

const ALCHEMY_KEY = 'alch_1dopTrVRUA_V7xM5E6HaJ';
const ALCHEMY_MAINNET = `https://tempo-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
check('a keyed endpoint is masked in messages', maskEndpoint(ALCHEMY_MAINNET), 'https://tempo-mainnet.g.alchemy.com/v2/***');
checkTrue('and the key itself never appears', !maskEndpoint(ALCHEMY_MAINNET).includes(ALCHEMY_KEY));
check(
  'a query-string key is masked too',
  maskEndpoint('https://rpc.example.io?apikey=secret123'),
  'https://rpc.example.io?apikey=***'
);
check('a keyless endpoint is left untouched', maskEndpoint('https://rpc.moderato.tempo.xyz'), 'https://rpc.moderato.tempo.xyz');

// Tonight's incident, verbatim, as a pure input: served mainnet, the legacy pair
// naming mainnet, but the legacy URL is the Moderato (testnet) endpoint.
const tonight: RpcCoherenceInput = {
  servedNetwork: 'mainnet',
  endpoints: {
    mainnet: 'https://rpc.moderato.tempo.xyz',
    testnet: 'https://rpc.moderato.tempo.xyz',
  },
  legacyChainId: String(TEMPO_MAINNET_CHAIN_ID),
  legacyRpcUrl: 'https://rpc.moderato.tempo.xyz',
};
const tonightVerdict = evaluateRpcCoherence(tonight);
check('tonight\'s config is incoherent', tonightVerdict.coherent, false);
check('the refusal names the served chain id', tonightVerdict.servedChainId, TEMPO_MAINNET_CHAIN_ID);
check('the refusal names the offending endpoint', tonightVerdict.endpoint, 'https://rpc.moderato.tempo.xyz');
check('the refusal names the network that endpoint belongs to', tonightVerdict.endpointNetwork, 'testnet');
checkTrue('the reason names the legacy chain id', (tonightVerdict.reason ?? '').includes(`TEMPO_CHAIN_ID=${TEMPO_MAINNET_CHAIN_ID}`));
checkTrue('the reason names the testnet endpoint', (tonightVerdict.reason ?? '').includes('rpc.moderato.tempo.xyz'));
checkTrue('the reason names the endpoint\'s own network', (tonightVerdict.reason ?? '').includes('the testnet network'));

const tonightError = new IncoherentRpcConfigError(tonightVerdict);
check('the typed error carries its code', tonightError.code, 'INCOHERENT_RPC_CONFIG');
checkTrue('the message is coded for a log grep', tonightError.message.includes('[INCOHERENT_RPC_CONFIG]'));
checkTrue('the message names the served chain id', tonightError.message.includes(`chain ${TEMPO_MAINNET_CHAIN_ID}`));
checkTrue('the message names the endpoint', tonightError.message.includes('rpc.moderato.tempo.xyz'));

// A shared endpoint, WITHOUT the legacy pair — the second rule.
const shared = evaluateRpcCoherence({
  servedNetwork: 'mainnet',
  endpoints: { mainnet: 'https://rpc.shared.example', testnet: 'https://rpc.shared.example' },
});
check('a shared endpoint is incoherent', shared.coherent, false);
check('and its network is reported unknown when the host says nothing', shared.endpointNetwork, null);
checkTrue('and the reason calls the endpoints IDENTICAL', (shared.reason ?? '').includes('IDENTICAL'));
checkTrue('and it still names the served chain id', (shared.reason ?? '').includes(`chain ${TEMPO_MAINNET_CHAIN_ID}`));

// The coherent shapes must NOT be refused.
const distinct = evaluateRpcCoherence({
  servedNetwork: 'mainnet',
  endpoints: { mainnet: 'https://rpc.tempo.xyz', testnet: 'https://rpc.moderato.tempo.xyz' },
});
check('distinct endpoints are coherent', distinct.coherent, true);
check('and a coherent verdict has no reason', distinct.reason, null);
check(
  'a legacy pair naming testnet with the Moderato endpoint is coherent',
  evaluateRpcCoherence({
    servedNetwork: 'testnet',
    endpoints: { mainnet: 'https://rpc.tempo.xyz', testnet: 'https://rpc.moderato.tempo.xyz' },
    legacyChainId: String(TEMPO_TESTNET_CHAIN_ID),
    legacyRpcUrl: 'https://rpc.moderato.tempo.xyz',
  }).coherent,
  true
);
check(
  'a legacy pair whose URL cannot be classified is not guessed at',
  evaluateRpcCoherence({
    servedNetwork: 'mainnet',
    endpoints: { mainnet: 'https://rpc.private.io', testnet: 'https://rpc.moderato.tempo.xyz' },
    legacyChainId: String(TEMPO_MAINNET_CHAIN_ID),
    legacyRpcUrl: 'https://rpc.private.io',
  }).coherent,
  true
);
check(
  'a legacy pair naming mainnet does not leak into a served testnet',
  evaluateRpcCoherence({
    servedNetwork: 'testnet',
    endpoints: { mainnet: 'https://rpc.tempo.xyz', testnet: 'https://rpc.moderato.tempo.xyz' },
    legacyChainId: String(TEMPO_MAINNET_CHAIN_ID),
    legacyRpcUrl: 'https://rpc.tempo.xyz',
  }).coherent,
  true
);

// ---------------------------------------------------------------------------
// (b) the runtime chain-id guard, against a stub
// ---------------------------------------------------------------------------
console.log('\n(b) the runtime chain-id guard, against a local stub endpoint:');

let stubChainIdHex = '0x1';
let ethChainIdHits = 0;
let blockNumberHits = 0;

const stub = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    let id: unknown = null;
    let method = '';
    try {
      const parsed = JSON.parse(body) as { id?: unknown; method?: string };
      id = parsed.id ?? null;
      method = parsed.method ?? '';
    } catch {
      // fall through with an empty method
    }
    if (method === 'eth_chainId') ethChainIdHits += 1;
    if (method === 'eth_blockNumber') blockNumberHits += 1;
    const result = method === 'eth_chainId' ? stubChainIdHex : '0x10';
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
  });
});

/**
 * Run the probe as a CHILD process and collect its output.
 *
 * Deliberately `spawn` (async), not `spawnSync`: the stub this check serves lives
 * in THIS process, so blocking the event loop until the child exits would starve
 * the very request the child is waiting for and deadlock both sides.
 */
function runProbe(stubUrl: string): Promise<{ status: number | null; output: string }> {
  const childEnv: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://seti:***@127.0.0.1:5433/seti?schema=public',
    JWT_SECRET: 'a-real-jwt-secret-that-is-not-the-placeholder',
    TEMPO_CHAIN_ID: String(TEMPO_TESTNET_CHAIN_ID),
    TEMPO_TESTNET_RPC_URL: stubUrl,
    TEMPO_TOKEN_PATHUSD: '0x20c0000000000000000000000000000000000000',
    TEMPO_TOKEN_OUSD: '0x20c0000000000000000000006a37da5c996874be',
    SETI_TREASURY_ADDRESS: '0x48cb25f9d82aF721e71437feAfb295da627BA475',
  };

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [tsxCli, probePath], {
      cwd: neutralCwd,
      env: childEnv,
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ status: code, output });
    });
  });
}

void (async () => {
  await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
  const address = stub.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const stubUrl = `http://127.0.0.1:${port}/v2/${ALCHEMY_KEY}`;

  // (b1) the stub reports the WRONG chain id for the served network.
  stubChainIdHex = '0x1';
  ethChainIdHits = 0;
  blockNumberHits = 0;
  const wrong = await runProbe(stubUrl);
  check('the mismatching probe exits 0 (the refusal is caught, not a crash)', wrong.status, 0);
  checkTrue('the probe never crashed', !wrong.output.includes('PROBE_CRASH'));
  checkTrue('the probe reached its end', wrong.output.includes('PROBE_DONE'));
  check('both calls were refused', (wrong.output.match(/PROBE attempt=\d+ refused/g) ?? []).length, 2);
  checkTrue('the refusal is the typed RpcChainIdMismatchError', wrong.output.includes('name=RpcChainIdMismatchError'));
  checkTrue('the refusal carries its code', wrong.output.includes('code=RPC_CHAIN_ID_MISMATCH'));
  checkTrue('the refusal is an instance of the typed error', wrong.output.includes('typed=true'));
  checkTrue('the refusal names the EXPECTED chain id', wrong.output.includes(`expected=${TEMPO_TESTNET_CHAIN_ID}`));
  checkTrue('the refusal names the REPORTED chain id', wrong.output.includes('reported=1'));
  checkTrue('the message names the endpoint as MASKED', wrong.output.includes(`http://127.0.0.1:${port}/v2/***`));
  checkTrue('and the endpoint key never appears', !wrong.output.includes(ALCHEMY_KEY));
  check('ONE eth_chainId call served two requests (the verdict is cached)', ethChainIdHits, 1);
  check('and NO business call leaked through the refusal', blockNumberHits, 0);

  // (b2) the stub reports the CORRECT chain id — the guard passes, the business
  // call goes through, and the verification still costs exactly one call.
  stubChainIdHex = `0x${TEMPO_TESTNET_CHAIN_ID.toString(16)}`;
  ethChainIdHits = 0;
  blockNumberHits = 0;
  const right = await runProbe(stubUrl);
  check('the matching probe exits 0', right.status, 0);
  check('both calls succeeded', (right.output.match(/PROBE attempt=\d+ ok block=/g) ?? []).length, 2);
  checkTrue('and the business call returned the stub block', right.output.includes('ok block=16'));
  check('ONE eth_chainId call served two requests (the verdict is cached)', ethChainIdHits, 1);
  check('and at least one business call reached the endpoint', blockNumberHits >= 1, true);

  stub.close();
  rmSync(neutralCwd, { recursive: true, force: true });

  console.log('-'.repeat(72));
  if (failures > 0) {
    console.log(`${failures} CHECK(S) FAILED.`);
    process.exit(1);
  }
  console.log(`${total} assertions passed.`);
})();
