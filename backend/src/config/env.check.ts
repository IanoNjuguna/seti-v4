/**
 * Production-config refusal checks.
 *
 * Run with:  npm run check:env    (or: npx tsx src/config/env.check.ts)
 *
 * The executable spec for the refusals in `config/env.ts`. It answers one
 * question: does a production process with an insecure value FAIL TO START?
 *
 * It cannot be a pure unit test. The guard runs at module load in `config/env`,
 * so "does it refuse" only has a true answer when a real process tries to boot.
 * Each case therefore spawns `env.boot-probe.ts` under tsx with a chosen
 * environment, in a working directory OUTSIDE `backend/` so the project's own
 * `.env` is never read (the cases set every variable they depend on; this file
 * never touches a real `.env`).
 *
 * The load-bearing cases are the refusals: DEV_BYPASS_AUTH, a missing
 * QUOTE_SIGNING_SECRET, and the two "boots healthy but cannot serve" omissions
 * — missing Privy credentials and a missing CORS allow-list — in production.
 * The rest pin the surrounding surface so a later change cannot quietly re-open
 * a door: the dev behaviour the fix must preserve, and the opt-in shape of
 * ALLOW_MAINNET.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The backend builds to CommonJS (no `"type": "module"` in package.json), so
// `import.meta` is unavailable here — `__dirname` and `require` are the module
// system actually in use.
const here = __dirname;
const probePath = join(here, 'env.boot-probe.ts');

// Resolve tsx absolutely so the child can run from a neutral working directory
// (the point of which is to keep a stray `.env` out of the verdict).
const tsxCli = require.resolve('tsx/cli');
const neutralCwd = mkdtempSync(join(tmpdir(), 'seti-env-check-'));

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/**
 * A production configuration that is safe to boot. Every case starts here and
 * overrides only what it is testing, so a case proves its variable changed the
 * verdict rather than that some other field happened to be missing.
 */
const SECURE_PRODUCTION: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://seti:seti@127.0.0.1:5433/seti?schema=public',
  JWT_SECRET: 'a-real-jwt-secret-that-is-not-the-placeholder',
  TEMPO_CHAIN_ID: '42431',
  TEMPO_TOKEN_PATHUSD: '0x20c0000000000000000000000000000000000000',
  TEMPO_TOKEN_OUSD: '0x20c0000000000000000000006a37da5c996874be',
  SETI_TREASURY_ADDRESS: '0x48cb25f9d82aF721e71437feAfb295da627BA475',
  DEV_BYPASS_AUTH: 'false',
  ALLOW_MAINNET: 'false',
  // 32 chars — comfortably above the minimum, so it is not itself a refusal.
  QUOTE_SIGNING_SECRET: '0123456789abcdef0123456789abcdef',
  // A production deploy must reach Privy and must have a CORS allow-list; both
  // are refusals when unset, so a "secure" fixture has to set them or every
  // boot case below would refuse for the wrong reason.
  PRIVY_APP_ID: 'clx0123456789abcdefghijkl',
  PRIVY_APP_SECRET: 'privy-app-secret-0123456789abcdef',
  CORS_ALLOWED_ORIGINS: 'https://app.seti.example',
};

interface ProbeResult {
  status: number | null;
  output: string;
}

function runProbe(overrides: Record<string, string | undefined>): ProbeResult {
  const childEnv: Record<string, string> = { PATH: process.env.PATH ?? '' };
  for (const [key, value] of Object.entries({ ...SECURE_PRODUCTION, ...overrides })) {
    if (value !== undefined) childEnv[key] = value;
  }

  const result = spawnSync(process.execPath, [tsxCli, probePath], {
    cwd: neutralCwd,
    env: childEnv,
    encoding: 'utf8',
    timeout: 60_000,
  });

  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

interface Case {
  name: string;
  overrides: Record<string, string | undefined>;
  expect: 'boots' | 'refuses';
  /** Substrings that must appear in the output (variable names, error code). */
  names?: string[];
  /** Substring that proves the boot completed. */
  bootsWith?: string;
  /** Exactly this many occurrences of the warn-once quote-key warning. */
  quoteWarnings?: number;
}

const WARN_ONCE = '[signed-token] QUOTE_SIGNING_SECRET is not set.';

const cases: Case[] = [
  {
    name: 'production refuses DEV_BYPASS_AUTH=true with a typed error',
    overrides: { DEV_BYPASS_AUTH: 'true' },
    expect: 'refuses',
    names: ['InsecureProductionConfigError', 'INSECURE_PRODUCTION_CONFIG', 'DEV_BYPASS_AUTH'],
  },
  {
    name: 'production refuses an unset QUOTE_SIGNING_SECRET',
    overrides: { QUOTE_SIGNING_SECRET: undefined },
    expect: 'refuses',
    names: ['INSECURE_PRODUCTION_CONFIG', 'QUOTE_SIGNING_SECRET'],
  },
  {
    name: 'production refuses a QUOTE_SIGNING_SECRET that is too short',
    overrides: { QUOTE_SIGNING_SECRET: 'short' },
    expect: 'refuses',
    names: ['QUOTE_SIGNING_SECRET'],
  },
  {
    name: 'production refuses the .env.example JWT_SECRET placeholder',
    overrides: { JWT_SECRET: 'change-me-in-production' },
    expect: 'refuses',
    names: ['INSECURE_PRODUCTION_CONFIG', 'JWT_SECRET'],
  },
  {
    name: 'production refuses an unset PRIVY_APP_ID',
    overrides: { PRIVY_APP_ID: undefined },
    expect: 'refuses',
    names: ['InsecureProductionConfigError', 'INSECURE_PRODUCTION_CONFIG', 'PRIVY_APP_ID'],
  },
  {
    name: 'production refuses an unset PRIVY_APP_SECRET',
    overrides: { PRIVY_APP_SECRET: undefined },
    expect: 'refuses',
    names: ['INSECURE_PRODUCTION_CONFIG', 'PRIVY_APP_SECRET'],
  },
  {
    name: 'production refuses both Privy credentials missing, and names both',
    overrides: { PRIVY_APP_ID: undefined, PRIVY_APP_SECRET: undefined },
    expect: 'refuses',
    names: ['PRIVY_APP_ID', 'PRIVY_APP_SECRET'],
  },
  {
    name: 'production refuses an unset CORS_ALLOWED_ORIGINS',
    overrides: { CORS_ALLOWED_ORIGINS: undefined },
    expect: 'refuses',
    names: ['InsecureProductionConfigError', 'INSECURE_PRODUCTION_CONFIG', 'CORS_ALLOWED_ORIGINS'],
  },
  {
    name: 'a blank CORS_ALLOWED_ORIGINS is refused like an unset one',
    overrides: { CORS_ALLOWED_ORIGINS: '   ' },
    expect: 'refuses',
    names: ['CORS_ALLOWED_ORIGINS'],
  },
  {
    name: 'the refusal names every offending variable at once',
    overrides: {
      DEV_BYPASS_AUTH: 'true',
      QUOTE_SIGNING_SECRET: undefined,
      JWT_SECRET: 'change-me-in-production',
      PRIVY_APP_ID: undefined,
      PRIVY_APP_SECRET: undefined,
      CORS_ALLOWED_ORIGINS: undefined,
    },
    expect: 'refuses',
    names: [
      'DEV_BYPASS_AUTH',
      'QUOTE_SIGNING_SECRET',
      'JWT_SECRET',
      'PRIVY_APP_ID',
      'PRIVY_APP_SECRET',
      'CORS_ALLOWED_ORIGINS',
    ],
  },
  {
    name: 'a secure production config boots',
    overrides: {},
    expect: 'boots',
    bootsWith: 'BOOTED node_env=production network=tempo-testnet',
  },
  {
    name: 'development with DEV_BYPASS_AUTH=true still boots (dev behaviour preserved)',
    overrides: { NODE_ENV: 'development', DEV_BYPASS_AUTH: 'true' },
    expect: 'boots',
    bootsWith: 'BOOTED node_env=development',
  },
  {
    name: 'development without QUOTE_SIGNING_SECRET boots and warns exactly once',
    overrides: { NODE_ENV: 'development', QUOTE_SIGNING_SECRET: undefined },
    expect: 'boots',
    bootsWith: 'BOOTED node_env=development',
    quoteWarnings: 1,
  },
  {
    name: 'production without a chain id still refuses (pre-existing guard)',
    overrides: { TEMPO_CHAIN_ID: undefined },
    expect: 'refuses',
    names: ['TEMPO_CHAIN_ID'],
  },
  {
    name: 'mainnet without ALLOW_MAINNET refuses — the flag stays opt-in',
    overrides: { TEMPO_CHAIN_ID: '4217', ALLOW_MAINNET: undefined },
    expect: 'refuses',
    names: ['ALLOW_MAINNET'],
  },
  {
    name: 'mainnet with a non-zero INDEXER_BOOTSTRAP_LOOKBACK refuses',
    overrides: { TEMPO_CHAIN_ID: '4217', ALLOW_MAINNET: 'true', INDEXER_BOOTSTRAP_LOOKBACK: '5000' },
    expect: 'refuses',
    names: ['INDEXER_BOOTSTRAP_LOOKBACK'],
  },
  {
    name: 'mainnet with ALLOW_MAINNET=true and lookback 0 boots',
    overrides: { TEMPO_CHAIN_ID: '4217', ALLOW_MAINNET: 'true' },
    expect: 'boots',
    bootsWith: 'BOOTED node_env=production network=tempo-mainnet',
  },
];

for (const testCase of cases) {
  const { status, output } = runProbe(testCase.overrides);
  const booted = output.includes('BOOTED') && status === 0;

  if (testCase.expect === 'refuses') {
    check(`${testCase.name} — exit is non-zero`, status !== 0, `exit=${String(status)}`);
    check(`${testCase.name} — never reached boot`, !output.includes('BOOTED'));
    for (const name of testCase.names ?? []) {
      check(`${testCase.name} — message names ${name}`, output.includes(name));
    }
  } else {
    check(`${testCase.name} — exit is 0`, status === 0, `exit=${String(status)}`);
    check(`${testCase.name} — reached boot`, booted);
    if (testCase.bootsWith) {
      check(`${testCase.name} — boot line`, output.includes(testCase.bootsWith), testCase.bootsWith);
    }
    if (testCase.quoteWarnings !== undefined) {
      const count = output.split(WARN_ONCE).length - 1;
      check(
        `${testCase.name} — quote warning printed exactly ${testCase.quoteWarnings}x`,
        count === testCase.quoteWarnings,
        `saw ${count}`
      );
    }
  }
}

rmSync(neutralCwd, { recursive: true, force: true });

console.log('-'.repeat(72));
if (failures > 0) {
  console.log(`${failures} CHECK(S) FAILED.`);
  process.exit(1);
}
console.log(`${total} assertions passed.`);
