/**
 * The convert quote: pairs, refusals, the slippage bound, and the book.
 *
 * Run with:  npx tsx src/services/convert.check.ts
 * (or `npm run check:convert` from the repo root.)
 *
 * Two halves, and the split is the point:
 *
 *  1. HERMETIC. Every refusal that must happen before the chain or the database
 *     is touched is asserted here with no Postgres, no wallet and no network —
 *     because those are the answers the app switches on, and a refusal that
 *     needed a database to be reached would be a 500 in production instead.
 *  2. LIVE. The book itself is read from the DEX precompile on the network this
 *     deployment serves, and the price is asserted to be at par within the spread
 *     measured on 2026-10-20 (0.00–0.02% on the pairs we offer). This half is what
 *     fails if the venue changes shape, the precompile moves, or someone widens
 *     the allowlist to a pair with no orders.
 *
 * What it deliberately does NOT do: sign, record, or write. There is no ledger in
 * this slice, so a suite that moved money to prove a quote would be proving the
 * wrong thing. The paired half of this work (record + receipt verification) gets
 * its own reconciliation against a real swap receipt when it lands.
 */
import {
  CONVERT_PAIRS,
  CONVERT_TOLERANCE_BPS,
  ConvertRefusalError,
  isAllowedPair,
  previewConvert,
  quoteDexConvert,
} from './convert.js';
import { networkConfigFor, servedNetwork } from './chain.js';
import { SUPPORTED_ASSETS } from '../config/assets.js';

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/** The refusal code a promise rejects with, or 'no-refusal' when it resolves. */
async function refusalOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return 'no-refusal';
  } catch (error) {
    return error instanceof ConvertRefusalError ? error.code : `unexpected:${String(error)}`;
  }
}

const NETWORK = servedNetwork;

async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  // (a) the allowlist is the measured book, not a permutation of four assets
  // -------------------------------------------------------------------------

  console.log(`allowlist (${NETWORK}):`);
  for (const [a, b] of CONVERT_PAIRS[NETWORK]) console.log(`     ${a} ↔ ${b}`);

  check(
    'usdt0 is offered on no network: neither the book nor Uniswap has a market for it',
    Object.values(CONVERT_PAIRS).every((pairs) => pairs.every(([a, b]) => a !== 'usdt0' && b !== 'usdt0'))
  );
  check(
    'the allowlist is symmetric: a pair can be converted in either direction',
    CONVERT_PAIRS[NETWORK].every(([a, b]) => isAllowedPair(a, b, NETWORK) && isAllowedPair(b, a, NETWORK))
  );
  check(
    'an unlisted pair is refused even though both assets are supported',
    isAllowedPair('usdt0', 'ousd', NETWORK) === false
  );

  // -------------------------------------------------------------------------
  // (b) refusals that must not need a chain or a database
  // -------------------------------------------------------------------------

  console.log('\nrefusals:');

  const sameAsset = await refusalOf(() =>
    previewConvert({ userId: 'check-convert', assetIn: 'ousd', assetOut: 'ousd', amountFiat: '100', network: NETWORK })
  );
  check('same asset in and out is refused by code', sameAsset === 'convert-same-asset', sameAsset);

  const unknownAsset = await refusalOf(() =>
    previewConvert({ userId: 'check-convert', assetIn: 'dai', assetOut: 'ousd', amountFiat: '100', network: NETWORK })
  );
  check('an asset this product does not support is refused by code', unknownAsset === 'convert-unknown-asset', unknownAsset);

  // The two refusals below are the same DISTINCTION on either network, and the
  // codes differ per network on purpose: `usdt0` is supported by the product and
  // absent from practice, which is `convert-unknown-asset`; a listed pair that the
  // allowlist does not carry is `convert-pair-unavailable`. Asserting the mainnet
  // answer while CI serves practice is what this suite did once, and it failed —
  // so both cases are derived from the network actually being served rather than
  // written down for one of them.
  const listed = networkConfigFor(NETWORK).assets;
  const foreign = SUPPORTED_ASSETS.find((a) => !listed.includes(a));
  if (foreign) {
    const code = await refusalOf(() =>
      previewConvert({ userId: 'check-convert', assetIn: foreign, assetOut: listed[0], amountFiat: '100', network: NETWORK })
    );
    check(
      `an asset this network does not list (${foreign}) is refused as unknown`,
      code === 'convert-unknown-asset',
      code
    );
  } else {
    console.log(`skip  every supported asset is listed on ${NETWORK}, so there is no foreign asset to refuse`);
  }

  const outsidePairs = listed
    .flatMap((a, i) => listed.slice(i + 1).map((b) => [a, b] as const))
    .filter(([a, b]) => !isAllowedPair(a, b, NETWORK));
  if (outsidePairs.length > 0) {
    const [pairIn, pairOut] = outsidePairs[0];
    const code = await refusalOf(() =>
      previewConvert({ userId: 'check-convert', assetIn: pairIn, assetOut: pairOut, amountFiat: '100', network: NETWORK })
    );
    check(
      `a listed pair with no market (${pairIn} → ${pairOut}) is refused by code`,
      code === 'convert-pair-unavailable',
      code
    );
  } else {
    console.log('skip  every listed pair is on the allowlist, so there is no unlisted pair to refuse');
  }

  const badAmount = await refusalOf(() =>
    previewConvert({ userId: 'check-convert', assetIn: 'ousd', assetOut: 'pathusd', amountFiat: '0', network: NETWORK })
  );
  check('a zero amount is refused by code', badAmount === 'convert-amount-invalid', badAmount);

  const notANumber = await refusalOf(() =>
    previewConvert({ userId: 'check-convert', assetIn: 'ousd', assetOut: 'pathusd', amountFiat: 'lots', network: NETWORK })
  );
  check('a non-numeric amount is refused by code', notANumber === 'convert-amount-invalid', notANumber);

  // -------------------------------------------------------------------------
  // (c) the book: live quotes on the pairs we offer
  // -------------------------------------------------------------------------

  console.log('\nlive quotes (10.000000 in):');

  for (const [a, b] of CONVERT_PAIRS[NETWORK]) {
    try {
      const quoted = await quoteDexConvert({
        assetIn: a,
        assetOut: b,
        amountIn: BigInt(10_000_000),
        network: NETWORK,
      });

      const out = Number(quoted.amountOut) / 1_000_000;
      const min = Number(quoted.minAmountOut) / 1_000_000;
      // Integer basis points, so the bound cannot fail on a float artefact: the
      // worst pair measured 2bps exactly, and 2.0000000004 > 2 in floating point.
      const spreadBps = Number(
        ((BigInt(10_000_000) - quoted.amountOut) * BigInt(10_000)) / BigInt(10_000_000)
      );

      check(`${a} → ${b} quotes`, quoted.amountOut > 0n, `${out.toFixed(6)} out`);
      check(
        `${a} → ${b} is at par within the measured spread (<= 2bps)`,
        spreadBps <= 2,
        `${spreadBps.toFixed(2)}bps`
      );
      check(
        `${a} → ${b} floor is the quote less ${CONVERT_TOLERANCE_BPS}bps, never above the quote`,
        quoted.minAmountOut < quoted.amountOut &&
          quoted.minAmountOut === (quoted.amountOut * BigInt(10_000 - CONVERT_TOLERANCE_BPS)) / BigInt(10_000),
        `min ${min.toFixed(6)}`
      );
    } catch (error) {
      // A pair on the allowlist that cannot quote is a FAILURE, not a skip: the
      // app offers it, so the book has to answer for it.
      check(`${a} → ${b} quotes`, false, error instanceof Error ? error.message : String(error));
    }
  }

  // A size nobody should be able to fill on a thin book, to prove the refusal
  // path is reachable rather than theoretical.
  const absurd = await refusalOf(() =>
    quoteDexConvert({
      assetIn: CONVERT_PAIRS[NETWORK][0][0],
      assetOut: CONVERT_PAIRS[NETWORK][0][1],
      amountIn: BigInt('1000000000000000000'), // 1e12 units
      network: NETWORK,
    })
  );
  check('a size the book cannot fill is refused as no-liquidity', absurd === 'convert-no-liquidity', absurd);

  console.log('-'.repeat(74));
  console.log(
    failures === 0 ? `All ${total} checks passed.` : `${failures} of ${total} checks FAILED.`
  );
  if (failures > 0) process.exit(1);
}

void main();
