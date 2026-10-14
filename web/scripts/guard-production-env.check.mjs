/**
 * Executable spec for the production build guard.
 *
 * Run with:  npm run check:build-env   (from web/, or the root `verify` gate)
 *
 * The guard refuses a production build whose `NEXT_PUBLIC_API_URL` is unset or
 * points at localhost / a private address, because that value is inlined into
 * the client bundle and cannot be corrected afterwards. This file answers a
 * question a pure unit test cannot: does a real BUILD PROCESS fail to start?
 *
 * So each case spawns the guard as its own process — the same way the build
 * scripts do — from a NEUTRAL working directory, so the repo's own `.env.local`
 * never colours the verdict. The cases that check environment-file resolution
 * write their own `.env.local` into a scratch directory and assert the guard
 * reads it (and that `process.env` still wins over it).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const guardPath = resolve(here, 'guard-production-env.mjs');

let total = 0;
let failures = 0;

function check(label, passed, detail = '') {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/** Run the guard in its own process, in `cwd`, with exactly `env` (plus PATH). */
function runGuard(env, cwd) {
  const childEnv = { PATH: process.env.PATH ?? '', ...env };
  const result = spawnSync(process.execPath, [guardPath], {
    cwd,
    env: childEnv,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

const scratch = mkdtempSync(join(tmpdir(), 'seti-build-guard-'));
const emptyDir = mkdtempSync(join(tmpdir(), 'seti-build-guard-empty-'));

const CASES = [
  {
    name: 'production refuses an unset NEXT_PUBLIC_API_URL',
    env: { NODE_ENV: 'production' },
    expect: 'refuses',
    names: ['INSECURE_PRODUCTION_BUILD', 'NEXT_PUBLIC_API_URL'],
  },
  {
    name: 'production refuses a blank NEXT_PUBLIC_API_URL',
    env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: '   ' },
    expect: 'refuses',
    names: ['NEXT_PUBLIC_API_URL'],
  },
  {
    name: 'production refuses the localhost fallback',
    env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'http://localhost:4000' },
    expect: 'refuses',
    names: ['INSECURE_PRODUCTION_BUILD', 'NEXT_PUBLIC_API_URL', 'localhost'],
  },
  {
    name: 'production refuses a *.localhost name',
    env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'http://api.localhost:4000' },
    expect: 'refuses',
    names: ['NEXT_PUBLIC_API_URL'],
  },
  {
    name: 'production refuses IPv4 loopback',
    env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4000' },
    expect: 'refuses',
    names: ['NEXT_PUBLIC_API_URL', 'private'],
  },
  {
    name: 'production refuses a 10.x private address',
    env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'http://10.1.2.3:4000' },
    expect: 'refuses',
    names: ['NEXT_PUBLIC_API_URL', 'private'],
  },
  {
    name: 'production refuses a 172.16/12 private address',
    env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'http://172.20.0.9:4000' },
    expect: 'refuses',
    names: ['NEXT_PUBLIC_API_URL', 'private'],
  },
  {
    name: 'production refuses a 192.168/16 private address',
    env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'http://192.168.0.101:4000' },
    expect: 'refuses',
    names: ['NEXT_PUBLIC_API_URL', 'private'],
  },
  {
    name: 'production refuses an IPv6 loopback address',
    env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'http://[::1]:4000' },
    expect: 'refuses',
    names: ['NEXT_PUBLIC_API_URL'],
  },
  {
    name: 'production refuses a malformed URL',
    env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'not-a-url' },
    expect: 'refuses',
    names: ['NEXT_PUBLIC_API_URL'],
  },
  {
    name: 'production accepts a public https URL',
    env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://api.seti.example' },
    expect: 'builds',
    names: ['api.seti.example'],
  },
  {
    name: 'development does NOT fire with the localhost default',
    env: { NODE_ENV: 'development', NEXT_PUBLIC_API_URL: 'http://localhost:4000' },
    expect: 'builds',
    names: ['development'],
  },
  {
    name: 'development does NOT fire with the variable unset',
    env: { NODE_ENV: 'development' },
    expect: 'builds',
    names: ['development'],
  },
];

for (const testCase of CASES) {
  const { status, output } = runGuard(testCase.env, emptyDir);

  if (testCase.expect === 'refuses') {
    check(`${testCase.name} — exit is non-zero`, status !== 0, `exit=${String(status)}`);
    for (const name of testCase.names ?? []) {
      check(`${testCase.name} — message names ${name}`, output.includes(name));
    }
    check(
      `${testCase.name} — says the value cannot be corrected after the build`,
      output.includes('cannot be corrected after the build'),
    );
  } else {
    check(`${testCase.name} — exit is 0`, status === 0, `exit=${String(status)}`);
    for (const name of testCase.names ?? []) {
      check(`${testCase.name} — output mentions ${name}`, output.includes(name));
    }
  }
}

// ---------------------------------------------------------------------------
// Environment-file resolution: the guard must read the same file the build
// does, or it would pass while the bundler bakes localhost.
// ---------------------------------------------------------------------------
console.log('\nenvironment-file resolution:');

writeFileSync(
  join(scratch, '.env.local'),
  '# scratch\nNEXT_PUBLIC_API_URL=http://localhost:4000\n',
);

const fromEnvFile = runGuard({ NODE_ENV: 'production' }, scratch);
check(
  'production reads .env.local and refuses a localhost value found there',
  fromEnvFile.status !== 0 && fromEnvFile.output.includes('.env.local'),
  `exit=${String(fromEnvFile.status)}`,
);

const processWins = runGuard(
  { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://api.seti.example' },
  scratch,
);
check(
  'process.env wins over .env.local (so a good override builds)',
  processWins.status === 0,
  `exit=${String(processWins.status)}`,
);

writeFileSync(
  join(scratch, '.env.production.local'),
  'NEXT_PUBLIC_API_URL=https://api-production.seti.example\n',
);
const mostSpecific = runGuard({ NODE_ENV: 'production' }, scratch);
check(
  '.env.production.local is read before .env.local',
  mostSpecific.status === 0 && mostSpecific.output.includes('api-production.seti.example'),
  `exit=${String(mostSpecific.status)}`,
);

rmSync(scratch, { recursive: true, force: true });
rmSync(emptyDir, { recursive: true, force: true });

console.log('-'.repeat(72));
if (failures > 0) {
  console.log(`${failures} CHECK(S) FAILED.`);
  process.exit(1);
}
console.log(`${total} assertions passed.`);
