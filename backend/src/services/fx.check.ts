/**
 * CHECK:FX-CBK — the rate the product prices at, and where it comes from (#586).
 *
 * Run with:  npm run check:fx-cbk
 * Requires:  nothing but the network (one live read), no database.
 *
 * The claims this suite pins:
 *
 *   (a) the Central Bank's rate WINS when it answers — the figure on a receipt is the
 *       Bank's, not a reseller's;
 *   (b) an implausible figure from the Bank is REFUSED, and the chain falls through: a
 *       unit slip from one host must not become the price on every payment;
 *   (c) the provider is the fallback, and says so, with no publication date claimed on
 *       its behalf;
 *   (d) with neither answering, the static figure is used and flagged `stale`, which is
 *       the honest answer rather than a 500 in front of a customer;
 *   (e) the relay's payload parses strictly: a row without a real date, or without a
 *       positive rate, is dropped rather than defaulted, and the newest date wins;
 *   (f) LIVE: the Bank's relay answers a plausible USD/KES with a date it could have
 *       published today;
 *   (g) `GET /rates` is registered with NO auth hook and answers the documented shape.
 *
 * (a) to (d) are measured in child processes (`fx.probe.ts`), one per scenario, because
 * `getFxQuote` caches its first answer for an hour: in one process the second scenario
 * would only read the first one's cache. Only `fetch` is stubbed there, and only for the
 * two hosts involved, so the sanity band, the cache and the freshness rule are the
 * production ones.
 */
import Fastify from 'fastify';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseCbkRatePayload, CBK_RATE_SOURCE } from './fx-cbk.js';
import { LIVE_RATE_SOURCE, FALLBACK_RATE_SOURCE, FALLBACK_FX } from './payments.js';

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

const probePath = join(__dirname, 'fx.probe.ts');
const tsxCli = require.resolve('tsx/cli');
const neutralCwd = mkdtempSync(join(tmpdir(), 'seti-fx-check-'));

/** The smallest configuration the service boots with. Nothing here is a secret. */
const PROBE_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  DEV_BYPASS_AUTH: 'true',
  DATABASE_URL: 'postgresql://seti:***@127.0.0.1:5433/seti?schema=public',
  TEMPO_CHAIN_ID: '42431',
  TEMPO_TOKEN_PATHUSD: '0x20c0000000000000000000000000000000000000',
  TEMPO_TOKEN_OUSD: '0x20c0000000000000000000006a37da5c996874be',
  SETI_TREASURY_ADDRESS: '0x48cb25f9d82aF721e71437feAfb295da627BA475',
  ALLOW_MAINNET: 'false',
};

interface Quote {
  fiatPerUsd: number;
  source: string;
  publishedFor: string | null;
  asOf: string;
  stale: boolean;
}

function probe(scenario: string): Quote | null {
  const result = spawnSync(process.execPath, [tsxCli, probePath], {
    cwd: neutralCwd,
    // The PARENT's environment, not a hand-written subset: the probe imports the real
    // service, so it validates the real configuration, and a subset that happens to be
    // complete on a developer's machine (where `backend/.env` exists) is not complete on
    // a runner (where only the workflow's `env:` block is). Inheriting is what makes the
    // probe measure the code rather than the fixture. The neutral cwd stays, so a stray
    // `.env` cannot become the crutch either way.
    env: { ...process.env, ...PROBE_ENV, FX_PROBE_SCENARIO: scenario },
    encoding: 'utf8',
    timeout: 60_000,
  });

  const line = `${result.stdout ?? ''}`
    .split('\n')
    .map((row) => row.trim())
    .filter((row) => row.startsWith('{'))
    .pop();

  if (!line) {
    console.log(
      `      probe ${scenario} printed nothing; stderr: ${(result.stderr ?? '').slice(0, 400)}`
    );
    return null;
  }

  try {
    return JSON.parse(line) as Quote;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  // ---------------------------------------------------------------- (a) to (d)
  console.log('the chain of sources, one process per scenario:');

  const bank = probe('cbk-ok');
  check('the Central Bank answers, and its rate is the price', bank?.fiatPerUsd === 129.99, String(bank?.fiatPerUsd));
  check('the source names the Bank', bank?.source === CBK_RATE_SOURCE, String(bank?.source));
  check('the publication day is carried', /^\d{4}-\d{2}-\d{2}$/.test(bank?.publishedFor ?? ''), String(bank?.publishedFor));
  check('and a rate published today is not stale', bank?.stale === false, String(bank?.stale));

  const slip = probe('cbk-slip');
  check(
    'a unit slip from the Bank is refused, not priced',
    slip?.fiatPerUsd === FALLBACK_FX.KES,
    String(slip?.fiatPerUsd)
  );
  check(
    'and the refusal falls through to the static figure',
    slip?.source === FALLBACK_RATE_SOURCE,
    String(slip?.source)
  );

  const provider = probe('provider-only');
  check('the provider is the fallback when the Bank is down', provider?.fiatPerUsd === 130.5, String(provider?.fiatPerUsd));
  check('and the source names the provider', provider?.source === LIVE_RATE_SOURCE, String(provider?.source));
  check(
    "and no publication day is claimed on the Bank's behalf",
    provider?.publishedFor === null,
    String(provider?.publishedFor)
  );

  const nothing = probe('nothing');
  check('with neither answering the static figure is used', nothing?.fiatPerUsd === FALLBACK_FX.KES, String(nothing?.fiatPerUsd));
  check('and it is flagged stale, which is what it is', nothing?.stale === true, String(nothing?.stale));

  // --------------------------------------------------------------------- (e)
  console.log('\nthe relay payload, parsed strictly:');
  {
    const series = [
      { date: '2026-11-17', base: 'USD', quote: 'KES', rate: 129.98 },
      { date: '2026-11-19', base: 'USD', quote: 'KES', rate: 129.99 },
      { date: '2026-11-18', base: 'USD', quote: 'KES', rate: 129.97 },
    ];
    const newest = parseCbkRatePayload(series, 'KES');
    check(
      'the newest date wins when the relay carries a series',
      newest?.publishedFor === '2026-11-19',
      String(newest?.publishedFor)
    );

    check('a row with no date is dropped', parseCbkRatePayload([{ base: 'USD', quote: 'KES', rate: 129.99 }], 'KES') === null);
    check('a date that is not a date is dropped', parseCbkRatePayload([{ date: '19/11/2026', rate: 129.99 }], 'KES') === null);
    check('a zero rate is dropped', parseCbkRatePayload([{ date: '2026-11-19', rate: 0 }], 'KES') === null);
    check('a non-numeric rate is dropped', parseCbkRatePayload([{ date: '2026-11-19', rate: '129.99' }], 'KES') === null);
    check('a payload that is not a series is refused', parseCbkRatePayload({ rates: { KES: 129.99 } }, 'KES') === null);
    check(
      "and another currency's row is not answered as KES",
      parseCbkRatePayload([{ date: '2026-11-19', quote: 'EUR', rate: 142.66 }], 'KES') === null
    );
  }

  // --------------------------------------------------------------------- (f)
  console.log('\nthe Bank, read live:');
  {
    const { fetchCbkRate } = await import('./fx-cbk.js');
    const live = await fetchCbkRate('KES');
    const today = new Date().toISOString().slice(0, 10);
    const age = live ? (Date.now() - Date.parse(`${live.publishedFor}T00:00:00Z`)) / 86_400_000 : Infinity;

    check('the relay answers', live !== null, String(live?.fiatPerUsd));
    check(
      'the figure is a plausible shilling rate',
      !!live && live.fiatPerUsd > 80 && live.fiatPerUsd < 300,
      String(live?.fiatPerUsd)
    );
    check('with a publication day that is not in the future', !!live && live.publishedFor <= today, String(live?.publishedFor));
    check('and is recent enough to price with', age <= 7, `${age.toFixed(2)} days`);
  }

  // --------------------------------------------------------------------- (g)
  console.log('\nthe route a stranger reads:');
  {
    const { publicRateRoutes } = await import('../routes/public-rates.js');
    const app = Fastify({ logger: false });
    await app.register(publicRateRoutes, { prefix: '/rates' });
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/rates' });
    const body = response.json<{ rate?: Record<string, unknown> }>();
    const rate = body.rate ?? {};

    check('GET /rates answers without a token', response.statusCode === 200, String(response.statusCode));
    check(
      'and carries the figure, its source, its day and its freshness',
      typeof rate.fiatPerUsd === 'number' &&
        typeof rate.source === 'string' &&
        'publishedFor' in rate &&
        typeof rate.stale === 'boolean',
      Object.keys(rate).join(',')
    );
    check(
      'the figure is the one the payment path would charge at',
      typeof rate.fiatPerUsd === 'number' && rate.fiatPerUsd > 80 && rate.fiatPerUsd < 300,
      String(rate.fiatPerUsd)
    );
    check(
      'and it is cacheable for minutes, not for a day',
      /max-age=\d{3}/.test(String(response.headers['cache-control'] ?? '')),
      String(response.headers['cache-control'])
    );

    await app.close();
  }

  rmSync(neutralCwd, { recursive: true, force: true });

  console.log('-------------------------------------------------------------------------');
  if (failures === 0) {
    console.log(`All ${total} checks passed.`);
    process.exit(0);
  }
  console.log(`${failures} of ${total} checks FAILED.`);
  process.exit(1);
}

void main();
