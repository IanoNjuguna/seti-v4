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
 *   4. The home payload's rows carry their own value and the total IS their sum —
 *      for an account holding two assets, one asset, or none (#222).
 *
 * It is hermetic: the summing loop takes its reader as an argument, so no chain
 * and no database are involved. The live reads are proven separately by the
 * `eth_call` transcript in the task report.
 */
import { assetsForChain, tokenAddressFor, TEMPO_ASSETS } from '../config/assets.js';
import { assetBalanceRows, homeBalanceInFiat, totalBalanceInFiat, sumBalancesInFiat } from './balance.js';
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

// ---------------------------------------------------------------------------
// (d) the rows behind the total
// ---------------------------------------------------------------------------

console.log('asset rows:');

// All four hold something.
{
  const { read, asked } = readerFor({ ousd: '1.50', pathusd: '2.25', usdt0: '3.00', 'usdc.e': '4.25' });
  const rows = await assetBalanceRows(read, mainnetAssets);

  check('one row per listed asset', rows.length === 4 && asked.length === 4, `${rows.length} rows`);
  check(
    'largest first',
    rows.map((row) => row.asset).join(',') === 'usdc.e,usdt0,pathusd,ousd',
    rows.map((row) => row.asset).join(',')
  );
  check(
    'symbols come from the registry',
    rows.map((row) => row.symbol).join(',') === 'USDC.e,USDT0,pathUSD,OUSD',
    rows.map((row) => row.symbol).join(',')
  );
  check('amounts are untouched strings, not re-formatted', rows[0]?.amount === '4.25', String(rows[0]?.amount));
}

// Everything arrived as USDT0: three real zeros, kept.
{
  const { read } = readerFor({ usdt0: '3.00' });
  const rows = await assetBalanceRows(read, mainnetAssets);
  const zeros = rows.filter((row) => Number(row.amount) === 0).length;

  check('zeros are kept, not dropped', rows.length === 4 && zeros === 3, `${rows.length} rows, ${zeros} zeros`);
  check('the funded asset leads', rows[0]?.asset === 'usdt0', String(rows[0]?.asset));
}

// The rows and the total are computed from the SAME read, so they cannot disagree.
{
  const { read } = readerFor({ ousd: '1.50', pathusd: '2.25', usdt0: '3.00', 'usdc.e': '4.25' });
  const rows = await assetBalanceRows(read, mainnetAssets);
  const fromRows = sumBalancesInFiat(rows.map((row) => ({ asset: row.asset, balance: row.amount })), RATE);
  const fromRead = await totalBalanceInFiat(readerFor({ ousd: '1.50', pathusd: '2.25', usdt0: '3.00', 'usdc.e': '4.25' }).read, mainnetAssets, RATE);

  check('the rows sum to the figure the card shows', fromRows === fromRead, `${fromRows} vs ${fromRead}`);
}

// A read that throws is the caller's problem, not a silently short list.
{
  let threw = false;
  try {
    await assetBalanceRows(async (asset) => {
      if (asset === 'usdt0') throw new Error('rpc down');
      return { asset, balance: '0.00' };
    }, mainnetAssets);
  } catch {
    threw = true;
  }
  check('a read that throws is not turned into a missing row', threw);
}


// ---------------------------------------------------------------------------
// (e) the home card: rows, each with its value, summing to the figure on top
// ---------------------------------------------------------------------------

console.log('\nthe home card: rows, their values, and the total:');

/** The rows' values added up the way a customer checking the card would. */
function sumValues(rows: ReadonlyArray<{ value: string }>): string {
  return rows.reduce((sum, row) => sum + Number(row.value), 0).toFixed(2);
}

// Two funded assets and two empty ones. The card has four rows, and the figure on
// top is those four added up — not a separately computed total that happens to agree.
{
  const { read } = readerFor({ ousd: '1.50', 'usdc.e': '4.25' });
  const rows = await assetBalanceRows(read, mainnetAssets);
  const { assets, balance } = homeBalanceInFiat(rows, RATE);

  check(
    'an account holding two assets gets a row per LISTED asset',
    assets.length === mainnetAssets.length,
    `${assets.length} rows for ${mainnetAssets.length} listed`
  );
  check(
    'two of those rows carry money',
    assets.filter((row) => Number(row.amount) > 0).length === 2,
    assets.map((row) => `${row.asset}:${row.amount}`).join(' ')
  );
  check(
    'every row carries its own value in the card currency',
    assets.every((row) => /^\d+\.\d{2}$/.test(row.value)),
    assets.map((row) => `${row.asset}:${row.value}`).join(' ')
  );
  check(
    'sum(assets.value) IS the total',
    sumValues(assets) === balance,
    `${sumValues(assets)} vs ${balance}`
  );
  check('and the total is the money, not the row count', balance === (5.75 * RATE).toFixed(2), `${balance} KES`);
}

// An account holding nothing. Every listed asset is a zero ROW, kept, and the total
// is their sum: zero, in the card's currency, at the card's rate. A payload that
// shrinks to an empty list for a new account would make the row count a property of
// this customer instead of the network.
{
  const { read } = readerFor({});
  const rows = await assetBalanceRows(read, mainnetAssets);
  const { assets, balance } = homeBalanceInFiat(rows, RATE);

  check(
    'an empty account still gets a row per listed asset',
    assets.length === mainnetAssets.length,
    `${assets.length} rows for ${mainnetAssets.length} listed`
  );
  check(
    'all of them are zero, none are dropped',
    assets.every((row) => row.amount === '0.00' && row.value === '0.00'),
    assets.map((row) => `${row.asset}:${row.value}`).join(' ')
  );
  check('sum(assets.value) is still the total', sumValues(assets) === balance && balance === '0.00', balance);
}

// The bug this issue was filed for: everything arrived as USDT0. One funded row,
// three real zeros — and the total is the funded row, visible as such.
{
  const { read } = readerFor({ usdt0: '3.00' });
  const rows = await assetBalanceRows(read, mainnetAssets);
  const { assets, balance } = homeBalanceInFiat(rows, RATE);
  const funded = assets.filter((row) => Number(row.amount) > 0);

  check(
    'a USDT0-only account shows one funded row and three zeros',
    assets.length === 4 && funded.length === 1 && funded[0]?.asset === 'usdt0',
    `${assets.length} rows, funded: ${funded.map((row) => row.asset).join(',')}`
  );
  check(
    'and the zeros carry no value while the funded row carries it all',
    assets.filter((row) => row.value === '0.00').length === 3 && assets[0]?.value === '388.50',
    assets.map((row) => `${row.asset}:${row.value}`).join(' ')
  );
  check('the total is that one row, not a figure from nowhere', balance === assets[0]?.value, balance);
}

// Practice lists three assets, so its card has three rows — the count comes from the
// network, not from a constant in the dashboard.
{
  const { read } = readerFor({ ousd: '1.00' });
  const rows = await assetBalanceRows(read, practiceAssets);
  const { assets, balance } = homeBalanceInFiat(rows, RATE);

  check(
    'a practice card has the practice registry’s row count',
    assets.length === 3 && sumValues(assets) === balance,
    `${assets.length} rows, ${balance}`
  );
}

// The rounding trap this identity exists to close. Rows rounded to a cent do NOT add
// up to a rounding of the whole, so a total computed from the amounts and a breakdown
// computed from the rows can sit a cent apart. The card shows the rows; the figure on
// top must therefore BE their sum.
{
  const oddRate = 129.555;
  const { read } = readerFor({ ousd: '0.01', pathusd: '0.01', usdt0: '0.01' });
  const rows = await assetBalanceRows(read, mainnetAssets);
  const { assets, balance } = homeBalanceInFiat(rows, oddRate);

  check(
    'rounding each row then adding differs from rounding the whole',
    balance !== (0.03 * oddRate).toFixed(2),
    `rows ${balance} vs whole ${(0.03 * oddRate).toFixed(2)}`
  );
  check('the card shows the sum of its rows, so the two agree', balance === sumValues(assets), balance);
}

// One rate for the whole card: doubling the rate doubles every row and the total,
// which is what "its value at the same rate the total used" has to mean.
{
  const { read } = readerFor({ ousd: '1.00', 'usdc.e': '2.00' });
  const rows = await assetBalanceRows(read, mainnetAssets);
  const once = homeBalanceInFiat(rows, RATE);
  const twice = homeBalanceInFiat(rows, RATE * 2);

  check(
    'rows and total are priced at ONE rate',
    twice.balance === (Number(once.balance) * 2).toFixed(2) &&
      once.assets.every((row, index) => twice.assets[index]?.value === (Number(row.value) * 2).toFixed(2)),
    `${once.balance} → ${twice.balance}`
  );
}

  console.log('-'.repeat(74));
  console.log(
    failures === 0
      ? `All ${total} checks passed.`
      : `${failures} of ${total} checks FAILED.`
  );

  if (failures > 0) process.exit(1);
}

void main();
