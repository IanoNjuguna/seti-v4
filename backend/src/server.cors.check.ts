/**
 * CORS plumbing checks.
 *
 * Run with:  npm run check:cors    (part of `npm run verify`)
 *
 * `CORS_ALLOWED_ORIGINS` became a production requirement because an empty list
 * denies every browser origin: the deploy boots healthy and then 403s (as an
 * opaque browser CORS failure) every request from the web app. This suite proves
 * the plumbing behind that requirement rather than trusting it:
 *
 *   1. the server actually READS the variable — changing the list changes the
 *      verdict, so it is not a hardcode;
 *   2. an origin IN the list is allowed (an `Access-Control-Allow-Origin` for
 *      that exact origin) and one MISSING from it is refused (no such header);
 *   3. development still reflects any origin, the behaviour the production
 *      allow-list must not regress;
 *   4. the production boot refusal still fires when the variable is unset.
 *
 * Cases 1–3 run the REAL server (`buildServer`) in its own process, over a real
 * loopback socket, driven by real `Origin` headers — see `server.cors.probe.ts`.
 * Case 4 spawns the same boot probe `check:env` uses, because "does production
 * refuse to boot" only has a true answer when a real process tries to boot.
 *
 * Both child processes run from a NEUTRAL working directory, so neither the
 * backend's own `.env` nor the developer's shell influences the verdict.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const here = __dirname;
const probePath = join(here, 'server.cors.probe.ts');
const bootProbePath = join(here, 'config', 'env.boot-probe.ts');
const tsxCli = require.resolve('tsx/cli');
const neutralCwd = mkdtempSync(join(tmpdir(), 'seti-cors-check-'));

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/**
 * A configuration the probe can boot with. Every case starts here and overrides
 * only the two variables under test, so a case proves the variable changed the
 * verdict rather than that some unrelated field happened to be missing.
 */
const BASE_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://seti:***@127.0.0.1:5433/seti?schema=public',
  JWT_SECRET: 'a-real-jwt-secret-that-is-not-the-placeholder',
  TEMPO_CHAIN_ID: '42431',
  TEMPO_TOKEN_PATHUSD: '0x20c0000000000000000000000000000000000000',
  TEMPO_TOKEN_OUSD: '0x20c0000000000000000000006a37da5c996874be',
  SETI_TREASURY_ADDRESS: '0x48cb25f9d82aF721e71437feAfb295da627BA475',
  DEV_BYPASS_AUTH: 'false',
  ALLOW_MAINNET: 'false',
};

interface OriginResult {
  origin: string;
  status: number;
  allowOrigin: string | null;
}

interface ProbeOutput {
  nodeEnv: string;
  results: OriginResult[];
  preflight: { origin: string; status: number; allowOrigin: string | null; allowMethods: string | null };
  noOrigin: { origin: null; status: number; allowOrigin: string | null };
}

function runProbe(overrides: Record<string, string | undefined>): {
  status: number | null;
  output: string;
  json?: ProbeOutput;
} {
  const childEnv: Record<string, string> = { PATH: process.env.PATH ?? '' };
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value !== undefined) childEnv[key] = value;
  }

  const result = spawnSync(process.execPath, [tsxCli, probePath], {
    cwd: neutralCwd,
    env: childEnv,
    encoding: 'utf8',
    timeout: 60_000,
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  // The server's own logger writes JSON lines to stdout too, so pick the line
  // that is actually the probe's payload rather than the first '{'.
  const payloadLine = (result.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
    .map((line) => {
      try {
        return JSON.parse(line) as Partial<ProbeOutput>;
      } catch {
        return undefined;
      }
    })
    .find((parsed) => parsed !== undefined && Array.isArray(parsed.results));
  return {
    status: result.status,
    output,
    json: payloadLine as ProbeOutput | undefined,
  };
}

/** `true` when the result for `origin` came back allowed for exactly that origin. */
function allowedFor(json: ProbeOutput | undefined, origin: string): boolean {
  const result = json?.results.find((entry) => entry.origin === origin);
  return Boolean(result && result.status === 200 && result.allowOrigin === origin);
}

/** `true` when the result for `origin` came back refused (no allow-origin header). */
function refusedFor(json: ProbeOutput | undefined, origin: string): boolean {
  const result = json?.results.find((entry) => entry.origin === origin);
  return Boolean(result && result.allowOrigin === null);
}

console.log('the allow-list is read and enforced (NODE_ENV=test):');

const listed = runProbe({
  NODE_ENV: 'test',
  CORS_ALLOWED_ORIGINS: 'https://app.seti.example',
});
check('the probe boots and answers', listed.status === 0, `exit=${String(listed.status)}`);
check('an origin IN the list is allowed', allowedFor(listed.json, 'https://app.seti.example'), JSON.stringify(listed.json?.results));
check('an origin MISSING from the list is refused', refusedFor(listed.json, 'https://evil.example'));
check('a second unlisted origin is also refused', refusedFor(listed.json, 'https://admin.seti.example'));
check(
  'the preflight for a listed origin is answered with that origin',
  listed.json?.preflight.allowOrigin === 'https://app.seti.example',
  String(listed.json?.preflight.allowOrigin)
);
check(
  'the preflight advertises the request method',
  (listed.json?.preflight.allowMethods ?? '').includes('GET'),
  String(listed.json?.preflight.allowMethods)
);
check(
  'a request with no Origin still succeeds and gains no CORS header',
  listed.json?.noOrigin.status === 200 && listed.json?.noOrigin.allowOrigin === null,
  `status=${String(listed.json?.noOrigin.status)} allowOrigin=${String(listed.json?.noOrigin.allowOrigin)}`
);

console.log('\nchanging the variable changes the verdict:');

// Same origin, different list: if the server hardcoded or ignored the variable,
// this would be impossible.
const swapped = runProbe({
  NODE_ENV: 'test',
  CORS_ALLOWED_ORIGINS: 'https://admin.seti.example',
});
check('the newly listed origin is now allowed', allowedFor(swapped.json, 'https://admin.seti.example'));
check('the previously listed origin is now refused', refusedFor(swapped.json, 'https://app.seti.example'));

// A comma-separated list with surrounding whitespace, the shape `.env` files use.
const multiple = runProbe({
  NODE_ENV: 'test',
  CORS_ALLOWED_ORIGINS: ' https://app.seti.example , https://admin.seti.example ',
});
check('a comma-separated list allows the first entry', allowedFor(multiple.json, 'https://app.seti.example'));
check('a comma-separated list allows the second entry', allowedFor(multiple.json, 'https://admin.seti.example'));
check('a comma-separated list still refuses an unlisted origin', refusedFor(multiple.json, 'https://evil.example'));

console.log('\ndevelopment still reflects any origin (the behaviour not to regress):');

const development = runProbe({ NODE_ENV: 'development', CORS_ALLOWED_ORIGINS: undefined });
check('development boots', development.status === 0, `exit=${String(development.status)}`);
check('development allows an origin that is in no list', allowedFor(development.json, 'https://evil.example'));

console.log('\nproduction still refuses to boot without the allow-list:');

const refused = (() => {
  const childEnv: Record<string, string> = { PATH: process.env.PATH ?? '' };
  // A production configuration that is otherwise secure, so the ONLY reason to
  // refuse is the missing allow-list.
  const secure: Record<string, string> = {
    ...BASE_ENV,
    NODE_ENV: 'production',
    QUOTE_SIGNING_SECRET: '0123456789abcdef0123456789abcdef',
    PRIVY_APP_ID: 'clx0123456789abcdefghijkl',
    PRIVY_APP_SECRET: 'privy-app-secret-0123456789abcdef',
  };
  for (const [key, value] of Object.entries(secure)) childEnv[key] = value;

  const result = spawnSync(process.execPath, [tsxCli, bootProbePath], {
    cwd: neutralCwd,
    env: childEnv,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
})();

check('production with CORS_ALLOWED_ORIGINS unset exits non-zero', refused.status !== 0, `exit=${String(refused.status)}`);
check('...never reaching boot', !refused.output.includes('BOOTED'));
check('...and the message names CORS_ALLOWED_ORIGINS', refused.output.includes('CORS_ALLOWED_ORIGINS'));
check(
  '...under the typed production error',
  refused.output.includes('INSECURE_PRODUCTION_CONFIG') || refused.output.includes('InsecureProductionConfigError')
);

rmSync(neutralCwd, { recursive: true, force: true });

console.log('-'.repeat(72));
if (failures > 0) {
  console.log(`${failures} CHECK(S) FAILED.`);
  process.exit(1);
}
console.log(`${total} assertions passed.`);
