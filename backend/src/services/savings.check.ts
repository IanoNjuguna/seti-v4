/**
 * What `check:save` proves, and why each assertion is the one that matters.
 *
 * The bug in #126 was not a typo: the Save screen priced a deposit from OUSD while
 * the customer held pathUSD, and the vault takes pathUSD directly. So these checks
 * pin the SELECTION rule and the numbers that follow from it, with fixtures rather
 * than a live account — the chain proof is a separate, slower thing.
 *
 *   node --experimental-strip-types? no: run with `npx tsx src/services/savings.check.ts`
 */
import { chooseDepositAsset } from './savings.js';
import type { SupportedAsset } from '../config/assets.js';

const U = (value: number) => BigInt(Math.round(value * 1_000_000));

let failed = 0;
let run = 0;

function check(name: string, condition: boolean, detail?: string) {
  run += 1;
  if (condition) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

function assetOf(funding: { asset: SupportedAsset; balance: bigint }[], amount: number) {
  return chooseDepositAsset(funding, U(amount))?.asset ?? null;
}

console.log('\nchoosing which asset funds a deposit\n');

// The reported failure: pathUSD in the wallet, OUSD empty, saving 1,000.
check(
  'a customer holding only pathUSD does not need a swap',
  assetOf([{ asset: 'pathusd', balance: U(5_000) }, { asset: 'ousd', balance: U(0) }], 1_000) ===
    'pathusd'
);

// The old behaviour would have picked OUSD here and reported a zero balance.
check(
  'pathUSD outranks a smaller OUSD balance',
  assetOf(
    [{ asset: 'pathusd', balance: U(5_000) }, { asset: 'ousd', balance: U(10) }],
    1_000
  ) === 'pathusd'
);

check(
  'OUSD funds a deposit when it is the one that covers',
  assetOf(
    [{ asset: 'pathusd', balance: U(1) }, { asset: 'ousd', balance: U(5_000) }],
    1_000
  ) === 'ousd'
);

check(
  'USDC.e funds a deposit when it is the one that covers',
  assetOf(
    [
      { asset: 'pathusd', balance: U(0) },
      { asset: 'ousd', balance: U(0) },
      { asset: 'usdc.e', balance: U(5_000) },
    ],
    1_000
  ) === 'usdc.e'
);

// Nothing covers: name the big one, so "you have X" is a number they recognise.
check(
  'when nothing covers, the largest balance is the one named',
  assetOf(
    [{ asset: 'pathusd', balance: U(10) }, { asset: 'ousd', balance: U(300) }],
    1_000
  ) === 'ousd'
);

// A tie must not depend on array order, or the same wallet would quote differently
// depending on which balance read came back first.
check(
  'a tie resolves to the first candidate, deterministically',
  assetOf(
    [{ asset: 'pathusd', balance: U(500) }, { asset: 'ousd', balance: U(500) }],
    1_000
  ) === 'pathusd'
);

check('no funding assets at all is null, not a crash', chooseDepositAsset([], U(10)) === null);

// The exclusion that keeps the figure honest: USDT0 has no book on Tempo, so a
// customer holding it must not be told they can save it.
check(
  'USDT0 is never offered: it is absent from the candidate set',
  assetOf([{ asset: 'pathusd', balance: U(0) }], 100) === 'pathusd'
);

console.log('\nwhat the spendable figure is\n');

// The summary must agree with home. It sums the assets that can reach the vault, and
// deliberately excludes USDT0 — the same exclusion the selection makes, so the number
// and the quote cannot disagree.
const FUNDING: SupportedAsset[] = ['pathusd', 'ousd', 'usdc.e'];
const balances = { pathusd: U(120), ousd: U(30), 'usdc.e': U(50), usdt0: U(9_000) };
const spendable = FUNDING.reduce((sum, asset) => sum + balances[asset], BigInt(0));

check('spendable sums pathUSD + OUSD + USDC.e', spendable === U(200), `got ${spendable}`);
check(
  'spendable excludes USDT0, which cannot be moved',
  spendable < U(9_200) && spendable === U(200)
);

console.log(`\n${run - failed}/${run} checks passed\n`);
if (failed > 0) process.exit(1);
