/**
 * `npm run check:pay-charge` — the pay page's promises, without a browser.
 *
 * The page renders amounts, a recipient and a QR that a stranger is asked to trust, so
 * the parts that decide those have to be provable rather than plausible. Four things
 * are pinned here:
 *
 *  1. **The refusal.** A charge whose signature does not hold is `invalid`, never a
 *     drawable charge. This is the one that matters most: everything else is a bug, and
 *     this one is money leaving a wallet.
 *  2. **The states.** Each of the six resolves from the money and the clock, including
 *     the case that a paid charge is never called expired.
 *  3. **The QR round-trip.** `readChargeId(buildChargeUri(id)) === id` for every id the
 *     page will accept — decoded, not eyeballed — plus the strings that must NOT parse.
 *  4. **The fee.** 2%, no floor, no cap, and the printed total equal to the printed
 *     lines above it.
 *
 * Run from `web/`: npm run check:pay-charge (part of the root `verify` gate).
 */
import { execFileSync } from 'node:child_process';
import { chargeAmounts } from '../lib/charges/charge-fee.ts';
import { buildChargeUri, readChargeId } from '../lib/charges/charge-uri.ts';
import { FIXTURE_PAYEE_DIRECTORY, fixtureChargeSource } from '../lib/charges/charge.fixture.ts';
import { loadCharge } from '../lib/charges/load-charge.ts';
import { formatFiat } from '../lib/formatCurrency.ts';

const NOW = new Date('2026-10-22T09:00:00.000Z');

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

/**
 * A charge loaded from the TEST DOUBLE.
 *
 * Since #131 the page's default source is the backend (`charge-source.ts`), so every
 * assertion about a STATE (pending, paid, expired, a forged signature) injects the
 * fixture instead. The loader is unchanged by that: it parses whatever it is given, so
 * what is pinned here is still the page, not a mock.
 */
async function load(id, extra = {}) {
  return loadCharge(id, {
    now: NOW,
    source: fixtureChargeSource,
    directory: FIXTURE_PAYEE_DIRECTORY,
    ...extra,
  });
}

console.log('the six states, resolved from the money and the clock:');
check(
  'a pending request is pending, and names a verified payee',
  await (async () => {
    const result = await load('ch_8f2c1a4e7b9d');
    return result.kind === 'charge' && result.status === 'pending' && result.payee.kind === 'handle' && result.payee.verified === true;
  })()
);
check(
  'a paid request is paid, and carries its receipt path',
  await (async () => {
    const result = await load('ch_4c9a0e2f6b71');
    return result.kind === 'charge' && result.status === 'paid' && result.charge.receiptPath !== null;
  })()
);
check(
  'a short arrival is underpaid, not pending',
  await (async () => {
    const result = await load('ch_5d1b7a3c8e04');
    return result.kind === 'charge' && result.status === 'underpaid';
  })()
);
check(
  'an arrival above the amount is overpaid, not paid',
  await (async () => {
    const result = await load('ch_6e2c8b4d9f35');
    return result.kind === 'charge' && result.status === 'overpaid';
  })()
);
check(
  'a request past its deadline with nothing received is expired',
  await (async () => {
    const result = await load('ch_9f3d1c7a2b68');
    return result.kind === 'charge' && result.status === 'expired';
  })()
);
check(
  'a paid request past its deadline is still paid',
  await (async () => {
    const result = await load('ch_4c9a0e2f6b71', { now: new Date('2030-01-01T00:00:00Z') });
    return result.kind === 'charge' && result.status === 'paid';
  })()
);

console.log('the refusal:');
check(
  'a signature that does not hold is invalid',
  await (async () => (await load('ch_1a7f4e9c2d60')).kind === 'invalid')()
);
check(
  'an invalid charge returns no amount, no payee and no id to draw',
  await (async () => {
    const result = await load('ch_1a7f4e9c2d60');
    return Object.keys(result).join(',') === 'kind';
  })()
);
check(
  'an id naming no charge is not-found',
  await (async () => (await load('ch_000000000000')).kind === 'not-found')()
);
check(
  'an id that is not a charge id never reaches a lookup',
  await (async () => {
    const ids = ['../../etc/passwd', 'CH_UPPER', 'ch_8f2c1a4e7b9d/x', '<script>', ''];
    for (const id of ids) {
      if ((await load(id)).kind !== 'not-found') return false;
    }
    return true;
  })()
);
check(
  'a payload whose shape is wrong is refused, not rendered',
  await (async () => {
    const broken = {
      async read() {
        return {
          kind: 'found',
          payload: { ...(await fixtureChargeSource.read('ch_8f2c1a4e7b9d')).payload, amount: '1250' },
        };
      },
    };
    return (await loadCharge('ch_8f2c1a4e7b9d', {
      now: NOW,
      source: broken,
      directory: FIXTURE_PAYEE_DIRECTORY,
    })).kind === 'invalid';
  })()
);

console.log('the recipient, resolved from the address:');
check(
  'a name whose binding points elsewhere is not shown as a name',
  await (async () => {
    const misdirected = {
      async findNamedPayee() {
        return {
          handle: 'ian',
          name: 'Ian Njuguna',
          address: '0x0000000000000000000000000000000000000001',
          verified: true,
        };
      },
    };
    const result = await loadCharge('ch_8f2c1a4e7b9d', {
      now: NOW,
      source: fixtureChargeSource,
      directory: misdirected,
    });
    return result.kind === 'charge' && result.payee.kind === 'address';
  })()
);
check(
  'an address with no name resolves to the address',
  await (async () => {
    const result = await load('ch_2b6d9c0f4a13');
    return result.kind === 'charge' && result.payee.kind === 'address';
  })()
);
check(
  'a name that is not verified is still shown, and marked unverified',
  await (async () => {
    const result = await load('ch_7a1e3d5b9c22');
    return result.kind === 'charge' && result.payee.kind === 'handle' && result.payee.verified === false;
  })()
);

console.log('the QR carries the charge, and decodes back to it:');
check(
  'every servable id round-trips through seti://pay/<id>',
  await (async () => {
    const ids = [
      'ch_8f2c1a4e7b9d',
      'ch_7a1e3d5b9c22',
      'ch_2b6d9c0f4a13',
      'ch_4c9a0e2f6b71',
      'ch_5d1b7a3c8e04',
      'ch_6e2c8b4d9f35',
      'ch_9f3d1c7a2b68',
    ];
    return ids.every((id) => readChargeId(buildChargeUri(id)) === id);
  })()
);
check(
  'the payload is a URI, not a bare address',
  buildChargeUri('ch_8f2c1a4e7b9d').startsWith('seti://pay/'),
  buildChargeUri('ch_8f2c1a4e7b9d')
);
check(
  'another scheme, an empty id and a smuggled path all fail to parse',
  ['https://seti.live/pay/ch_8f2c1a4e7b9d', 'seti://pay/', 'seti://pay/ch_8f2c1a4e7b9d/x'].every(
    (uri) => readChargeId(uri) === null
  )
);

console.log('the fee: 2%, no floor, no cap, and a total that adds up:');
const big = chargeAmounts(1250, 'KES');
check('2% of KES 1,250.00 is KES 25.00', formatFiat(big.fee, 'KES') === 'KES 25.00', formatFiat(big.fee, 'KES'));
check('the total is KES 1,275.00', formatFiat(big.total, 'KES') === 'KES 1,275.00');
const small = chargeAmounts(50, 'KES');
check(
  'a KES 50.00 charge carries KES 1.00, not a KES 50.00 floor',
  formatFiat(small.fee, 'KES') === 'KES 1.00',
  formatFiat(small.fee, 'KES')
);
const large = chargeAmounts(99000, 'KES');
check(
  'a KES 99,000.00 charge carries KES 1,980.00, not a capped fee',
  formatFiat(large.fee, 'KES') === 'KES 1,980.00',
  formatFiat(large.fee, 'KES')
);
const yen = chargeAmounts(1200, 'JPY');
check(
  'a currency with no minor unit rounds its fee to the unit',
  formatFiat(yen.fee, 'JPY') === 'JPY 24' && formatFiat(yen.total, 'JPY') === 'JPY 1,224',
  `${formatFiat(yen.fee, 'JPY')} / ${formatFiat(yen.total, 'JPY')}`
);
check(
  'the printed lines add up to the printed total',
  [1250, 50, 99, 19.99, 3.33, 7777.77].every((amount) => {
    const parts = chargeAmounts(amount, 'KES');
    return formatFiat(parts.amount + parts.fee, 'KES') === formatFiat(parts.total, 'KES');
  })
);

/*
 * 5. The fixture is not in the page's path at all (#161, restated by #131).
 *
 * A fixture charge names an amount and an address nobody controls, so nothing a
 * deployed build can reach may answer one. Before #131 that guarantee depended on a
 * `NODE_ENV` flag read at module load; now it is structural — the loader's default
 * source is the BACKEND, and the fixture is reachable only through `deps.source`.
 *
 * Three things are proved here:
 *
 *   a. the default source asks the public charge API, for `/public/charges/<id>` — the
 *      path this PR added — and neither reads nor knows about the fixture;
 *   b. with the API answering `404` for every fixture id (the answer a backend that
 *      has never heard of them gives), a PRODUCTION build renders none of them;
 *   c. a `422` from the API — the backend's "this does not verify" — is the page's
 *      REFUSAL, not its 404, so a forged link never reads as a dead link.
 */
{
  const originalFetch = globalThis.fetch;
  const asked = [];

  /** Stub the API: record the URL, answer `status` with an empty body. */
  const stubApi = (status) => {
    globalThis.fetch = async (url) => {
      asked.push(String(url));
      return new Response('{}', { status });
    };
  };

  stubApi(404);
  const fixtureAnswer = await loadCharge('ch_8f2c1a4e7b9d', { now: NOW });
  globalThis.fetch = originalFetch;

  check(
    'the default source asks the public charge API',
    asked.some((url) => url.endsWith('/public/charges/ch_8f2c1a4e7b9d')),
    asked.join(',')
  );
  check(
    'and a 404 from it renders not-found, never a fixture',
    fixtureAnswer.kind === 'not-found',
    fixtureAnswer.kind
  );

  stubApi(422);
  const refusedByApi = await loadCharge('ch_8f2c1a4e7b9d', { now: NOW });
  globalThis.fetch = originalFetch;

  check(
    "the backend's refusal is the page's refusal, not its 404",
    refusedByApi.kind === 'invalid',
    refusedByApi.kind
  );
  check(
    'and a refusal draws no amount, no payee and no id',
    Object.keys(refusedByApi).join(',') === 'kind',
    Object.keys(refusedByApi).join(',')
  );

  // (b) in a child process, where NODE_ENV=production is what a deployed build sees.
  const loaderUrl = new URL('../lib/charges/load-charge.ts', import.meta.url).href;
  const fixtureUrl = new URL('../lib/charges/charge.fixture.ts', import.meta.url).href;
  const probe = `
    globalThis.fetch = async () => new Response('{}', { status: 404 });
    const { loadCharge } = await import(${JSON.stringify(loaderUrl)});
    const { FIXTURE_CHARGE_IDS } = await import(${JSON.stringify(fixtureUrl)});
    const leaked = [];
    for (const id of FIXTURE_CHARGE_IDS) {
      const r = await loadCharge(id);
      if (r.kind !== 'not-found') leaked.push(id + ':' + r.kind);
    }
    if (leaked.length) { console.error(leaked.join(',')); process.exit(3); }
  `;

  let refused = false;
  try {
    execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', probe], {
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'pipe',
      timeout: 60_000,
    });
    refused = true;
  } catch (error) {
    const said = String(error.stderr ?? error.message).trim().split('\n').slice(-1)[0] ?? '';
    check('a deployed build refuses every fixture id', false, said.slice(0, 140));
  }
  if (refused) check('a deployed build refuses every fixture id', true);
}

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);