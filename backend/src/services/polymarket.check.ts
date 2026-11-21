/**
 * The Polymarket card's promises, pinned (#599).
 *
 * Run with:  npx tsx src/services/polymarket.check.ts
 * (or `npm run check:polymarket` from the repo root.)
 *
 * The card shows a customer what an external account of theirs is worth. Four things can
 * go wrong in a way that is invisible on screen, and this suite pins each of them:
 *
 *   1. **A failure rendered as zero.** The worst outcome for a money surface is a figure
 *      that reads `0` because the upstream timed out. So a 5xx, a dropped connection, a
 *      retired API version and an unreadable body must each be a NAMED refusal, never a
 *      zero, and the retired case gets its own code because Polymarket answers HTTP 410
 *      for `v1` rather than a 404.
 *   2. **An empty wallet mistaken for an error.** A linked wallet with no positions is an
 *      answer: `positions: []` and a real total. The two states must not collapse.
 *   3. **An address stored that cannot be a wallet.** The zero address satisfies every
 *      shape check and can only ever answer "no positions".
 *   4. **A read that quietly starts talking to a chain.** This module is a read of a
 *      public REST API: no RPC client, no key material, one pinned host. The last two
 *      claims are asserted against the source text, because they are absences and an
 *      absence is exactly what a future edit removes without a test noticing.
 *
 * It is hermetic: every read goes through an injected fetcher and the rate through an
 * injected quote, so no network, no database and no provider are involved.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getPolymarketView,
  mapPolymarketView,
  normalizePolymarketAddress,
  POLYMARKET_DATA_BASE,
  PolymarketRefusalError,
} from './polymarket.js';

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

const ADDRESS = '0x2c335066fe58fe9237c3d3dc7b275c2a034a0563';
const QUOTE = { fiatCurrency: 'KES', fiatPerUsd: 129.25, source: 'cbk', stale: false };

const VALUE_BODY = { data: { proxy_wallet: ADDRESS, value: 385565.0053 } };

/** One position in the shape the live endpoint returns, trimmed to what the card reads. */
const POSITION = {
  proxy_wallet: ADDRESS,
  title: 'Will Benjamin Netanyahu be the next Prime Minister of Israel?',
  slug: 'will-benjamin-netanyahu-be-the-next-prime-minister-of-israel',
  outcome: 'No',
  end_date: '2026-10-28',
  current_size: 223127.3677,
  avg_price: 0.679,
  current_price: 0.7875,
  current_value: 175712.802,
  unrealized_pnl: 24208.4268,
  total_pnl: 22966.5754,
  percent_pnl: 15.9786,
  redeemable: false,
};

function refusalCode(fn: () => unknown): string {
  try {
    fn();
    return 'no-throw';
  } catch (error) {
    return error instanceof PolymarketRefusalError ? error.code : `wrong-error:${(error as Error).name}`;
  }
}

async function asyncRefusalCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'no-throw';
  } catch (error) {
    return error instanceof PolymarketRefusalError ? error.code : `wrong-error:${(error as Error).name}`;
  }
}

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** A fetcher that answers per path, and records every URL it was asked for. */
function stubFetcher(
  routes: Record<string, () => Response>,
  seen: string[]
): (url: string) => Promise<Response> {
  return async (url: string) => {
    seen.push(url);
    const key = Object.keys(routes).find((path) => url.includes(path));
    if (!key) throw new Error(`unstubbed request: ${url}`);
    return routes[key]();
  };
}

async function main(): Promise<void> {
  // 1. Addresses that cannot be wallets.
  check(
    'a malformed address is refused, not stored',
    refusalCode(() => normalizePolymarketAddress('0xabc')) === 'polymarket-address-invalid'
  );
  check(
    'a non-hex address is refused',
    refusalCode(() => normalizePolymarketAddress('not-an-address')) === 'polymarket-address-invalid'
  );
  check(
    'the zero address is refused',
    refusalCode(() => normalizePolymarketAddress('0x0000000000000000000000000000000000000000')) ===
      'polymarket-address-invalid'
  );
  check('a real address is lower-cased', normalizePolymarketAddress(ADDRESS.toUpperCase().replace('0X', '0x')) === ADDRESS);

  // 2. The mapping: money, in the customer's currency, at one named rate.
  /** A cent of tolerance: these are products of a float rate, not ledger integers. */
  const near = (actual: number, expected: number): boolean => Math.abs(actual - expected) < 0.01;
  const healthy = mapPolymarketView({
    address: ADDRESS,
    valueBody: VALUE_BODY,
    positionsBody: { data: [POSITION] },
    quote: QUOTE,
  });
  check(
    'a linked wallet reports its total in KES',
    healthy.fiatCurrency === 'KES' && near(healthy.totalFiat, 49834276.94),
    `total=${healthy.totalFiat}`
  );
  check('the rate used is carried on the response', healthy.fxRate === '129.2500' && healthy.fxSource === 'cbk');
  check(
    'a row is converted at the same rate as the headline',
    near(healthy.positions[0].currentValueFiat, 22710879.66) && near(healthy.positions[0].totalPnlFiat, 2968429.87),
    `value=${healthy.positions[0].currentValueFiat} pnl=${healthy.positions[0].totalPnlFiat}`
  );
  check('the redeemable count is derived from the rows', healthy.redeemableCount === 0);

  const withRedeemable = mapPolymarketView({
    address: ADDRESS,
    valueBody: VALUE_BODY,
    positionsBody: { data: [POSITION, { ...POSITION, redeemable: true }] },
    quote: QUOTE,
  });
  check('a resolved market is counted', withRedeemable.redeemableCount === 1);

  // 3. An empty wallet is an answer, not a failure.
  const empty = mapPolymarketView({
    address: ADDRESS,
    valueBody: { data: { proxy_wallet: ADDRESS, value: 0 } },
    positionsBody: { data: [] },
    quote: QUOTE,
  });
  check('an empty wallet answers with no positions rather than throwing', empty.positions.length === 0);
  check('an empty wallet still carries a real total and rate', empty.totalFiat === 0 && empty.fxRate === '129.2500');

  // 4. A body this build cannot read is a named refusal, never a zero.
  check(
    'a position missing a required field is refused',
    refusalCode(() =>
      mapPolymarketView({
        address: ADDRESS,
        valueBody: VALUE_BODY,
        positionsBody: { data: [{ ...POSITION, current_value: undefined }] },
        quote: QUOTE,
      })
    ) === 'polymarket-payload'
  );
  check(
    'a value body with no value is refused',
    refusalCode(() =>
      mapPolymarketView({ address: ADDRESS, valueBody: { data: {} }, positionsBody: { data: [] }, quote: QUOTE })
    ) === 'polymarket-payload'
  );
  check(
    'an unusable rate is refused rather than rendered as zero',
    refusalCode(() =>
      mapPolymarketView({
        address: ADDRESS,
        valueBody: VALUE_BODY,
        positionsBody: { data: [] },
        quote: { ...QUOTE, fiatPerUsd: 0 },
      })
    ) === 'polymarket-unavailable'
  );

  // 5. Transport failures, each with its own code.
  const seen: string[] = [];
  const retired = await asyncRefusalCode(() =>
    getPolymarketView({
      address: ADDRESS,
      fiatCurrency: 'KES',
      fetcher: stubFetcher({ '/value': () => response(410, {}), '/positions': () => response(200, { data: [] }) }, seen),
      readQuote: async () => QUOTE,
    })
  );
  check('a retired API version has its own code', retired === 'polymarket-retired', retired);

  const broken: string[] = [];
  const unavailable = await asyncRefusalCode(() =>
    getPolymarketView({
      address: ADDRESS,
      fiatCurrency: 'KES',
      fetcher: stubFetcher({ '/value': () => response(503, {}), '/positions': () => response(200, { data: [] }) }, broken),
      readQuote: async () => QUOTE,
    })
  );
  check('an upstream 5xx is unavailable, not zero', unavailable === 'polymarket-unavailable', unavailable);

  const dropped: string[] = [];
  const droppedCode = await asyncRefusalCode(() =>
    getPolymarketView({
      address: ADDRESS,
      fiatCurrency: 'KES',
      fetcher: async (url: string) => {
        dropped.push(url);
        throw new Error('ECONNRESET');
      },
      readQuote: async () => QUOTE,
    })
  );
  check('a dropped connection is unavailable', droppedCode === 'polymarket-unavailable', droppedCode);

  // 6. The happy read: exactly two HTTPS reads, both to the pinned host and version.
  const readUrls: string[] = [];
  const view = await getPolymarketView({
    address: ADDRESS,
    fiatCurrency: 'KES',
    fetcher: stubFetcher(
      { '/value': () => response(200, VALUE_BODY), '/positions': () => response(200, { data: [POSITION] }) },
      readUrls
    ),
    readQuote: async () => QUOTE,
  });
  check('a live read answers with the mapped view', view.positions.length === 1 && near(view.totalFiat, 49834276.94));
  check('the read is exactly two requests', readUrls.length === 2, `n=${readUrls.length}`);
  check(
    'every request is HTTPS to the pinned host and version',
    readUrls.every((url) => url.startsWith(`${POLYMARKET_DATA_BASE}/`)) && POLYMARKET_DATA_BASE.endsWith('/v2')
  );

  // 7. The two absences, asserted against the source: no chain client, no key material.
  const source = readFileSync(join(__dirname, 'polymarket.ts'), 'utf8');
  check('the service contains no RPC endpoint', !/rpc\.tempo|rpc\.moderato|eth_call|eth_getLogs/.test(source));
  check('the service contains no key material', !/privateKey|PRIVATE_KEY|mnemonic|seedPhrase/.test(source));

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}  ${total - failures}/${total} checks passed`);
  if (failures > 0) process.exitCode = 1;
}

void main();
