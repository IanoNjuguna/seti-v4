/**
 * The four-asset balance sum.
 *
 * Run with:  npx tsx src/services/balance-assets.check.ts
 * (or `npm run check:balances` from the repo root.)
 *
 * The bug this pins: a customer bridged USDT into Tempo, LayerZero delivered
 * USDT0, and the app showed a zero balance because it only read OUSD and pathUSD.
 * The money was on-chain at an address Seti already knew; the READ was too narrow.
 *
 * So this asserts the three things that make that impossible again:
 *
 *   1. Every chain lists the assets its registry lists — four on mainnet, three
 *      on practice (USDT0 is not on the practice registry, and is NOT faked).
 *   2. Those addresses are the registry's, per chain — bridged USDC differs
 *      between chains, so a shared address would be a transfer to nowhere.
 *   3. The balance read sums all of them into ONE fiat figure at ONE rate, and a
 *      zero in three of them still yields the right total.
 *
 * It is hermetic: the summing loop takes its reader as an argument, so no chain
 * and no database are involved. The live reads are proven separately by the
 * `eth_call` transcript in the task report.
 */
import { assetsForChain, tokenAddressFor, TEMPO_ASSETS } from '../config/assets.js';
import { totalBalanceInFiat, sumBalancesInFiat } from './balance.js';
import type { SupportedAsset } from '../config/networks.js';

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

const MAINNET = 4217;
const PRACTICE = 42431;

// ---------------------------------------------------------------------------
// (a) what each chain lists, in display order
// ---------------------------------------------------------------------------

console.log('asset list per chain:');

const mainnetAssets = assetsForChain(MAINNET);
const practiceAssets = assetsForChain(PRACTICE);

check('mainnet lists all four, OUSD first', mainnetAssets.join(',') === 'ousd,pathusd,usdt0,usdc.e', mainnetAssets.join(', '));
check('practice lists three, OUSD first', practiceAssets.join(',') === 'ousd,pathusd,usdc.e', practiceAssets.join(', '));
check(
  'USDT0 is absent from practice, not pointed at a guessed address',
  !practiceAssets.includes('usdt0') && tokenAddressFor('usdt0', PRACTICE) === undefined
);

// The registry reports 6 decimals for every token it lists; the table is the one
// place the app asserts that.
check(
  'every asset carries 6 decimals',
  TEMPO_ASSETS.every((entry) => entry.decimals === 6),
  TEMPO_ASSETS.map((entry) => `${entry.asset}:${entry.decimals}`).join(' ')
);

// ---------------------------------------------------------------------------
// (b) the addresses are the registry's, per chain
// ---------------------------------------------------------------------------

console.log('\naddresses (from tokenlist.tempo.xyz/list/<chainId>):');

const EXPECTED: Array<[SupportedAsset, number, string]> = [
  ['ousd', MAINNET, '0x20c0000000000000000000006a37da5c996874be'],
  ['pathusd', MAINNET, '0x20c0000000000000000000000000000000000000'],
  ['usdt0', MAINNET, '0x20c00000000000000000000014f22ca97301eb73'],
  ['usdc.e', MAINNET, '0x20c000000000000000000000b9537d11c60e8b50'],
  ['ousd', PRACTICE, '0x20c0000000000000000000006a37da5c996874be'],
  ['pathusd', PRACTICE, '0x20c0000000000000000000000000000000000000'],
  ['usdc.e', PRACTICE, '0x20c0000000000000000000009e8d7eb59b783726'],
];

for (const [asset, chainId, expected] of EXPECTED) {
  const actual = tokenAddressFor(asset, chainId);
  check(`${asset} on ${chainId}`, actual?.toLowerCase() === expected, actual ?? '(absent)');
}

check(
  'bridged USDC is a DIFFERENT contract on each chain',
  tokenAddressFor('usdc.e', MAINNET) !== tokenAddressFor('usdc.e', PRACTICE)
);

/**
 * Sections (c) and (d) await the summing loop, and this file is compiled as CJS
 * (no top-level await), so they run inside one async main.
 */
async function main(): Promise<void> {
// ---------------------------------------------------------------------------
// (c) the sum — one fiat figure from every listed asset
// ---------------------------------------------------------------------------

console.log('\nbalance sum (rate 129.50 KES per USD):');

const RATE = 129.5;

/** A reader that answers per asset, so the loop is exercised with fixed figures. */
function readerFor(balances: Partial<Record<SupportedAsset, string>>) {
  const asked: SupportedAsset[] = [];
  const read = async (asset: SupportedAsset) => {
    asked.push(asset);
    return { asset, balance: balances[asset] ?? '0.00' };
  };
  return { read, asked };
}

// All four hold something: 1.50 + 2.25 + 3.00 + 4.25 = 11.00 USD.
{
  const { read, asked } = readerFor({
    ousd: '1.50',
    pathusd: '2.25',
    usdt0: '3.00',
    'usdc.e': '4.25',
  });
  const result = await totalBalanceInFiat(read, mainnetAssets, RATE);

  check('every listed asset is read, once each', asked.length === 4 && new Set(asked).size === 4, asked.join(', '));
  check('four balances sum into ONE fiat figure', result === '1424.50', `${result} KES`);
  check('and the arithmetic is the sum, not the largest', result === (11 * RATE).toFixed(2));
}

// The bug, exactly: everything arrived as USDT0 and the other three are empty.
{
  const { read } = readerFor({ usdt0: '3.00' });
  const result = await totalBalanceInFiat(read, mainnetAssets, RATE);

  check('zero in three of four still yields the right total', result === '388.50', `${result} KES`);
  check('a balance that is entirely USDT0 is no longer read as zero', result !== '0.00', result);
}

// The same shape in bridged USDC, which is the other currency a bridge delivers.
{
  const { read } = readerFor({ 'usdc.e': '12.00' });
  const result = await totalBalanceInFiat(read, mainnetAssets, RATE);
  check('a balance that is entirely USDC.e is read too', result === '1554.00', `${result} KES`);
}

// Every asset empty is genuinely zero, and it is still a fiat figure.
{
  const { read } = readerFor({});
  const result = await totalBalanceInFiat(read, mainnetAssets, RATE);
  check('no money reads as 0.00 in fiat', result === '0.00', result);
}

// Practice sums only what practice lists — three assets, so USDT0 cannot appear.
{
  const { read, asked } = readerFor({ usdt0: '3.00' });
  const result = await totalBalanceInFiat(read, practiceAssets, RATE);
  check('practice sums its own three-asset list', asked.join(',') === 'ousd,pathusd,usdc.e', asked.join(', '));
  check('and a USDT0 balance is not counted on a chain that cannot hold it', result === '0.00', result);
}

// One conversion, applied once: doubling the rate doubles the figure.
{
  const balances = { ousd: '1.50', pathusd: '2.25', usdt0: '3.00', 'usdc.e': '4.25' };
  const single = await totalBalanceInFiat(readerFor(balances).read, mainnetAssets, RATE);
  const doubled = await totalBalanceInFiat(readerFor(balances).read, mainnetAssets, RATE * 2);
  check('the sum is converted at ONE rate, not per asset', Number(doubled) === Number(single) * 2);
}

// ---------------------------------------------------------------------------
// (d) the total is a fiat figure and nothing else
// ---------------------------------------------------------------------------

console.log('\ncopy: the total names no token:');

{
  const { read } = readerFor({ ousd: '1.50', pathusd: '2.25', usdt0: '3.00', 'usdc.e': '4.25' });
  const result = await totalBalanceInFiat(read, mainnetAssets, RATE);

  check(
    'the figure carries no asset name',
    !/ousd|pathusd|usdt0|usdc\.e|usd|token/i.test(result),
    result
  );
  check('it has exactly two decimal places', /^\d+\.\d{2}$/.test(result), result);
}

// A malformed balance must not be counted as zero: dropping it would hide money.
check(
  'a malformed balance is not silently dropped',
  Number.isNaN(Number(sumBalancesInFiat([{ asset: 'ousd', balance: 'not-a-number' }], RATE)))
);


  console.log('-'.repeat(74));
  console.log(
    failures === 0
      ? `All ${total} checks passed.`
      : `${failures} of ${total} checks FAILED.`
  );

  if (failures > 0) process.exit(1);
}

void main();
