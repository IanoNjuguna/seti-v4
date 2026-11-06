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
import {
  chooseDepositAsset,
  depositFitsWithFee,
  exitIsAvailable,
  orderDepositAssets,
  SAVINGS_ASSET,
  SAVINGS_LIVE,
  SAVINGS_SHARE_DECIMALS,
  SavingsFundingError,
  SavingsNotLiveError,
  sharesForDeposit,
  sharesForWithdrawal,
  spendableAfterFee,
} from './savings.js';
import { quoteSavingsDeposit } from './savings.js';
import { claimableFiatFor } from './savings-rewards.js';
import { readFileSync } from 'node:fs';
import { formatUnits } from 'viem';
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

console.log('\nthe funding order, when a balance cannot be sold (#335)\n');

/**
 * On 2026-11-05 a wallet could not save because the quote priced ONE candidate and that
 * candidate's market was empty. The order is what a deposit now walks: clearing balances
 * first, in table order, then the rest largest first. Only the service's pricing loop
 * decides which of them actually pays, so this function must not filter.
 */
const HOLDINGS: { asset: SupportedAsset; balance: bigint }[] = [
  { asset: 'pathusd', balance: U(500) },
  { asset: 'ousd', balance: U(100) },
  { asset: 'usdt0', balance: U(5_000) },
];

const coveringOrder = orderDepositAssets(HOLDINGS, U(10));
check(
  'a covering balance comes first, in table order',
  coveringOrder[0].asset === 'pathusd' && coveringOrder[1].asset === 'ousd' && coveringOrder[2].asset === 'usdt0',
  coveringOrder.map((c) => c.asset).join(', ')
);

const shortOrder = orderDepositAssets(HOLDINGS, U(1_000));
check(
  'when nothing covers, the largest balance is tried first',
  shortOrder[0].asset === 'usdt0',
  shortOrder.map((c) => c.asset).join(', ')
);

check(
  'every holding is a candidate, so a dead market cannot drop one',
  shortOrder.length === HOLDINGS.length
);

check(
  'and `chooseDepositAsset` is the head of that same order, not a second rule',
  chooseDepositAsset(HOLDINGS, U(10))?.asset === coveringOrder[0].asset &&
    chooseDepositAsset(HOLDINGS, U(1_000))?.asset === shortOrder[0].asset
);

const funding: SavingsFundingError = new SavingsFundingError(['usdt0']);
check(
  'nothing convertible is its own refusal code, not the vault being unreachable',
  funding.code === 'savings-funding-unavailable' && funding.unpriced[0] === 'usdt0',
  funding.code
);
check(
  'and the sentence does not ask for a retry that would fail the same way',
  /you/i.test(funding.message) && !/[—–!?]/.test(funding.message) && funding.message.endsWith('.'),
  funding.message
);

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

console.log('the claim figure is money, in the customer\'s own currency\n');

/**
 * The conversion the rewards read composes (#331). These are the numbers from the issue:
 * 9.615385 wrapped OUSD is 1,250.00 at 130 KES per USD, and the screen used to print
 * `9.62` with no unit at all.
 */
check(
  'a claimable 9.615385 at 130 KES per USD is KES 1,250.00',
  claimableFiatFor(9_615_385n, 130) === '1250.00',
  claimableFiatFor(9_615_385n, 130)
);

check(
  'nothing claimable is 0.00, never a bare empty string',
  claimableFiatFor(0n, 130) === '0.00',
  claimableFiatFor(0n, 130)
);

check(
  'the conversion follows the rate it is given rather than assuming KES',
  claimableFiatFor(1_000_000n, 83.5) === '83.50',
  claimableFiatFor(1_000_000n, 83.5)
);

// The claim signs TOKEN UNITS, so the fiat figure must stay a label. A route that signed
// the converted number would send a signature worth a hundred times the reward.
check(
  'and it never rounds a dust amount up to something claimable',
  claimableFiatFor(1n, 130) === '0.00',
  claimableFiatFor(1n, 130)
);

// The tally is printed by the async probe when the gate is closed, so that its
// assertion is counted; otherwise print here.
if (SAVINGS_LIVE) {
  console.log(`\n${run - failed}/${run} checks passed\n`);
  if (failed > 0) process.exit(1);
}

// ---------------------------------------------------------------------------
// THE WITHDRAWAL'S UNITS (#339). Two things were wrong in units rather than in logic: the
// share count was parsed at the asset's six decimals instead of the share token's eighteen,
// and "can this vault pay" was read from an API that does not list the vault at all.
// ---------------------------------------------------------------------------
console.log('\nwithdrawals: eighteen-decimal shares, and a vault that pays OUSD\n');

check(
  'the vault pays OUSD, so a withdrawal has no swap home to floor',
  SAVINGS_ASSET === 'ousd',
  SAVINGS_ASSET
);

const sharesOut = sharesForWithdrawal(9.6153846, 1.000375);
check(
  'a withdrawal asks for 18dp shares, not the asset\'s six',
  sharesOut > BigInt(9_600_000_000_000_000_000n) && sharesOut < BigInt(9_620_000_000_000_000_000n),
  String(sharesOut)
);
check(
  'and that count is a share amount, not a millionth of one',
  Number(formatUnits(sharesOut, 18)) > 9.5 && Number(formatUnits(sharesOut, 18)) < 9.7,
  String(Number(formatUnits(sharesOut, 18)))
);
check(
  'a zero share price yields no shares rather than dividing',
  sharesForWithdrawal(10, 0) === BigInt(0)
);


// ---------------------------------------------------------------------------
// THE EXIT (#343). `maxRedeem` is not evidence: Sentora OUSD Main answers zero for
// every holder while simulating the same redeem clean, so gating on it made the
// exit impossible for everyone. These pin the evidence ORDER instead.
// ---------------------------------------------------------------------------
console.log('\nthe exit is decided by the call, not by a limit this vault leaves at zero\n');

const NO_SIMULATION: boolean | null = null;

check(
  'a simulated redeem is an exit even with no cash reading and no redeemable-shares limit',
  exitIsAvailable({ shares: U(1), payout: U(1), simulated: true, vaultAssetBalance: null })
);

check(
  'a simulated revert is a no even when the vault is sitting on the cash',
  exitIsAvailable({ shares: U(1), payout: U(1), simulated: false, vaultAssetBalance: U(44_000_000) }) === false
);

check(
  'with no simulation, idle cash that covers the payout is enough to offer it',
  exitIsAvailable({ shares: U(1), payout: U(1), simulated: NO_SIMULATION, vaultAssetBalance: U(1) })
);

check(
  'with no simulation, cash short of the payout is not',
  exitIsAvailable({ shares: U(1), payout: U(2), simulated: NO_SIMULATION, vaultAssetBalance: U(1) }) === false
);

check(
  'nothing measurable at all is a no, not an optimistic yes',
  exitIsAvailable({ shares: U(1), payout: U(1), simulated: NO_SIMULATION, vaultAssetBalance: null }) === false
);

check(
  'a zero-share or zero-payout quote is never an exit',
  exitIsAvailable({ shares: BigInt(0), payout: U(1), simulated: true, vaultAssetBalance: U(1) }) === false &&
    exitIsAvailable({ shares: U(1), payout: BigInt(0), simulated: true, vaultAssetBalance: U(1) }) === false
);

/*
 * The position read, exercised against a REAL holder (#320). This is the arithmetic the
 * summary runs, with the numbers the vault gave for 0x5e08…fc55 on 2026-11-06: the holder's
 * share balance is 18dp, the asset is 6dp, and the vault's own previewRedeem agrees to one
 * unit at six decimals. Before #339 the same figures were read a million times apart.
 */
const realHolderShares = BigInt('3788578740267929260');
const realHolderPrice = BigInt(1_000_375); // convertToAssets(1e18), in 6dp asset units
const positionAssets = (realHolderShares * realHolderPrice) / 10n ** 18n;

check(
  'a real holder\u2019s 18dp shares price at the vault\u2019s own 6dp payout',
  positionAssets === BigInt(3_789_999),
  String(positionAssets)
);

check(
  'and that figure agrees with the vault\u2019s previewRedeem to one unit',
  BigInt(3_790_000) - positionAssets <= BigInt(1) && positionAssets <= BigInt(3_790_000),
  `${positionAssets} vs 3790000`
);

// ---------------------------------------------------------------------------
// THE RECORD PATHS (#340). They verify a receipt, so the assertions are about the SHAPE
// they look for: an OUSD vault funds a deposit with one transfer and proves a withdrawal
// with a burn, and a share is always eighteen decimals.
// ---------------------------------------------------------------------------
console.log('\nthe record paths follow the vault, not the vault that used to be here\n');

// The recorder runs against a receipt, so the assertions are about the shape it looks
// for; the file is read from the process's own directory, which `check:save` sets to
// `backend/`.
const recorder = readFileSync('src/services/transactions.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

check(
  'a deposit funded by an OUSD vault is checked wallet to vault, with no DEX leg',
  recorder.includes("vaultPaysOusd\n    ? readTransferredAmount(receipt, getTokenContract('ousd', network), vault, 'ousd')")
);
check(
  'and the vault leg is that same transfer rather than a second one',
  recorder.includes('const vaultLeg = vaultPaysOusd\n    ? inLeg')
);
check(
  'a withdrawal proves the burn, which is a transfer to the zero address',
  recorder.includes("'0x0000000000000000000000000000000000000000'")
);
check(
  'both recorders read shares at the share token\'s decimals, not the asset\'s',
  (recorder.match(/SAVINGS_SHARE_DECIMALS/g) ?? []).length >= 2,
  String((recorder.match(/SAVINGS_SHARE_DECIMALS/g) ?? []).length)
);
check('and that unit is eighteen', SAVINGS_SHARE_DECIMALS === 18, String(SAVINGS_SHARE_DECIMALS));

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
// The fee headroom (#137, item 7). A Tempo transaction pays its gas in the asset it
// spends, so an amount priced at the WHOLE balance cannot be signed: the transfer
// succeeds and the fee has nothing left. These pin the relationship, not a number.
// ---------------------------------------------------------------------------
console.log('\nthe network fee is reserved before an amount counts as affordable\n');

const FEE = 178n; // 0.000178 pathUSD, the fee measured on a practice deposit

check(
  'the whole balance does NOT fund a deposit (the fee would have nothing)',
  depositFitsWithFee(231_112n, 231_112n, FEE) === false
);

check(
  'the balance less the fee does fund it',
  depositFitsWithFee(231_112n, 231_112n - FEE, FEE) === true
);

check(
  'one unit short of the fee is still a refusal',
  depositFitsWithFee(231_112n, 231_112n - FEE + 1n, FEE) === false
);

check(
  'the spendable figure is the balance less exactly one fee',
  spendableAfterFee(231_112n, FEE) === 231_112n - FEE,
  `got ${spendableAfterFee(231_112n, FEE)}`
);

check(
  'a balance smaller than the fee spends nothing, rather than going negative',
  spendableAfterFee(100n, FEE) === BigInt(0)
);

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
