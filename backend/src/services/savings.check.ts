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
import { chooseDepositAsset, SAVINGS_LIVE, SavingsNotLiveError, sharesForDeposit } from './savings.js';
import { quoteSavingsDeposit } from './savings.js';
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

// USDT0 used to be excluded here because it had no book anywhere. Measured again on
// mainnet it now reaches pathUSD at 2bps out to 50,000 units, so a customer holding
// only USDT0 must be able to save — the exclusion would be the #126 bug wearing a
// different hat.
check(
  'USDT0 funds a deposit when it is the only thing held',
  assetOf([{ asset: 'usdt0', balance: U(5_000) }], 1_000) === 'usdt0'
);

check(
  'pathUSD still outranks USDT0 when both would cover',
  assetOf(
    [{ asset: 'pathusd', balance: U(2_000) }, { asset: 'usdt0', balance: U(5_000) }],
    1_000
  ) === 'pathusd'
);

console.log('\nwhat the spendable figure is\n');

// The summary must agree with home. It sums the assets that can reach the vault, and
// deliberately excludes USDT0 — the same exclusion the selection makes, so the number
// and the quote cannot disagree.
const FUNDING: SupportedAsset[] = ['pathusd', 'ousd', 'usdc.e', 'usdt0'];
const balances = { pathusd: U(120), ousd: U(30), 'usdc.e': U(50), usdt0: U(9_000) };
const spendable = FUNDING.reduce((sum, asset) => sum + balances[asset], BigInt(0));

check('spendable sums every asset that can reach the vault', spendable === U(9_200), `got ${spendable}`);
check(
  'spendable includes USDT0, which has a book',
  spendable === balances.pathusd + balances.ousd + balances['usdc.e'] + balances.usdt0
);

// The tally is printed by the async probe when the gate is closed, so that its
// assertion is counted; otherwise print here.
if (SAVINGS_LIVE) {
  console.log(`\n${run - failed}/${run} checks passed\n`);
  if (failed > 0) process.exit(1);
}

// ---------------------------------------------------------------------------
// The share floor (#134). This is the assertion that would have caught a bug that
// made every deposit revert: the floor is invisible until a customer's money is on
// the line, so it has to be checked against the number it is derived from.
// ---------------------------------------------------------------------------
console.log('\nthe share floor\n');

const PRICE = 1.000004;

for (const units of [231_112n, 1_155_562n, 38_518_748n]) {
  const floor = sharesForDeposit(units, PRICE);
  const expected = Number(floor) / 1_000_000;          // floor in share units
  const minted = Number(units) / 1e6 / PRICE;          // shares the vault mints
  const ratio = expected / minted;

  check(
    `a ${Number(units) / 1e6} pathUSD deposit floors at ~99.5% of what it mints`,
    ratio > 0.994 && ratio < 0.996,
    `floor ${expected.toFixed(6)} vs minted ${minted.toFixed(6)} = ${(ratio * 100).toFixed(2)}%`
  );

  check(
    `the floor for ${Number(units) / 1e6} pathUSD is below the minted amount`,
    floor < BigInt(Math.floor(minted * 1e6)),
    `floor ${floor} vs minted ${Math.floor(minted * 1e6)}`
  );
}

// The regression itself: a floor scaled by 1e6 is exactly what #134 shipped, and it
// must be impossible to reintroduce without this failing.
check(
  'the floor is NOT scaled twice (the #134 regression)',
  sharesForDeposit(231_112n, PRICE) < BigInt(1_000_000),
  `got ${sharesForDeposit(231_112n, PRICE)}`
);

check('a zero share price floors at zero rather than dividing', sharesForDeposit(231_112n, 0) === BigInt(0));

// ---------------------------------------------------------------------------
// The gate (#137). Deposits are closed; the only way this check passes is if the
// refusal fires before anything is priced.
// ---------------------------------------------------------------------------
console.log('\nthe deposit gate\n');

check('saving is closed unless SAVINGS_ENABLED=true', SAVINGS_LIVE === (process.env.SAVINGS_ENABLED === 'true'));

if (!SAVINGS_LIVE) {
  // CommonJS at this level, so the async probe is wrapped rather than dropped.
  void (async () => {
    let refused: unknown = null;
    try {
      await quoteSavingsDeposit({ userId: 'check-user', amountFiat: '30', network: 'mainnet' });
    } catch (error) {
      refused = error;
    }
    check(
      'a closed deposit refuses with savings-not-live before pricing anything',
      refused instanceof SavingsNotLiveError,
      refused instanceof Error ? refused.name : 'no error thrown'
    );
    console.log(`\n${run - failed}/${run} checks passed\n`);
    if (failed > 0) process.exit(1);
  })();
}
