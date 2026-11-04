/**
 * The convert quote: pairs, refusals, the slippage bound, and the book.
 *
 * Run with:  npx tsx src/services/convert.check.ts
 * (or `npm run check:convert` from the repo root. `CONVERT_BOOK_REPORT=1` runs the
 * nightly book report instead, see REPORT MODE below.)
 *
 * Requires:  docker compose up -d  (the `seti-postgres` container) for the route
 *            section, which authenticates through the development bypass and needs a
 *            user row. The book matrix, the allowlist, the refusals and the amount
 *            rule need no database.
 *
 * WHAT WE ASSERT, AND WHAT WE ONLY REPORT (#303)
 *
 * This suite asserts what is OURS and reports what is not:
 *
 *  - ASSERTED, because a person changed this repository and the merge should stop:
 *    the allowlist, the refusal code every surface answers with, the amount rule,
 *    the floor we promise on a quote, and the par band MEASURED for each pair and
 *    side (`PAR_BAND_BPS` below, with the date it was taken).
 *  - REPORTED, because nothing here can fix it: a third party's inventory. Whether
 *    Tempo's enshrined DEX holds the token on the side you are selling at 03:00
 *    tomorrow is not a fact about Seti. On mainnet the USDT0 side of two books went
 *    empty, `usdt0 → ousd` and `usdt0 → pathusd` refused at every size with
 *    `convert-no-liquidity`, and this suite read that as hard failures on the gate
 *    every merge has to pass.
 *
 * So `convert-no-liquidity` is printed as `report` and counts as nothing, while a
 * refusal with ANY OTHER code stays a hard failure: that one means our mapping
 * broke (an asset we list is not, a pair we allow has no contracts) rather than the
 * market emptying. A gate must not depend on who holds USDT0 at that hour; it may
 * depend on what we wrote down.
 *
 * Four halves, and the split is the point:
 *
 *  1. THE BOOK, as a MATRIX: every pair on the allowlist, BOTH directions, at
 *     10.000000 in, one line each: `ok` (answered, inside its measured band),
 *     `report` (the venue refused: a one-sided market), `FAIL` (a refusal code we
 *     did not expect, a band nobody measured, or a spread outside the band plus
 *     headroom).
 *  2. HERMETIC. Every refusal that must happen before the chain or the database
 *     is touched is asserted here with no Postgres, no wallet and no network —
 *     because those are the answers the app switches on, and a refusal that
 *     needed a database to be reached would be a 500 in production instead.
 *  3. THE AMOUNT RULE (`resolveConvertAmount`), pure: how much of a balance may be
 *     signed, which is the balance less gas because Tempo charges the fee in the
 *     token being spent. Signing the whole balance reverts on chain (#105).
 *  4. THE QUOTE ROUTE, over HTTP with the real auth guard: the five refusals #240
 *     names, each with its own code, plus one successful quote of a pair the matrix
 *     above saw a book on (and a skip naming why when none did), and the assertion
 *     that asking wrote no row. The schema is where a refusal code is lost — a
 *     `z.enum` for the assets answers 400 where the app expects
 *     `convert-unknown-asset` — so the route is driven rather than described.
 *
 * REPORT MODE (`CONVERT_BOOK_REPORT=1`), for a nightly job: prints the network
 * line, the matrix, then one `summary: <n> answered, <m> refused`, and exits 0
 * having touched neither Postgres nor Fastify. A nightly job that went red on a
 * third party's inventory would page somebody about a market, and one that opened a
 * database connection to read a public book would be one more thing to break at
 * 03:00. Nothing in report mode can fail the process: the only way out non-zero is
 * this file throwing.
 *
 * What it deliberately does NOT do: sign, record, or write. A quote is a read, and
 * a suite that moved money to prove one would be proving the wrong thing. The
 * record path is proved by `check:convert-record` against a real swap receipt.
 */
// Fastify is a TYPE here and is imported for its factory only inside the route
// section, below, together with Prisma and the route itself: report mode must be
// able to run on a box with no database and no server, so those four modules are
// loaded where they are used rather than at the top of this file.
import type { FastifyInstance } from 'fastify';
import { parseUnits } from 'viem';
import {
  CONVERT_AMOUNT_MAX,
  CONVERT_PAIRS,
  CONVERT_ROW_TARGET,
  CONVERT_TOLERANCE_BPS,
  ConvertRefusalError,
  isAllowedPair,
  previewConvert,
  quoteDexConvert,
  resolveConvertAmount,
  type ConvertQuote,
} from './convert.js';
import { STABLECOIN_DEX_ADDRESS, networkConfigFor, servedNetwork } from './chain.js';
import { ASSET_DECIMALS, SUPPORTED_ASSETS, type SupportedAsset } from '../config/assets.js';
import { readQuote } from './quote.js';
import { SETTLE_TARGET } from './settlement.js';
import type { Network } from '../lib/network.js';

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

/**
 * The network whose BOOK the par-band matrix measures.
 *
 * THE PAR BAND IS A CLAIM ABOUT THE BOOK THE PRODUCT QUOTES ON, and that is mainnet,
 * not the network the gate happens to be running on. CI pins `TEMPO_CHAIN_ID=42431`
 * so no runner reaches a mainnet endpoint for the rest of the gate, and that pin used
 * to carry this matrix with it. On 2026-11-04 practice's OUSD/pathUSD book was
 * one-sided — `ousd → pathusd` 1.00 bps, `pathusd → ousd` 96.00 bps — against a band of
 * 1 bp and a ceiling of 15, so the suite refused it, correctly, about a testnet. It
 * failed identically on a docs-only branch, blocked every merge in the repository, and
 * stopped `deploy.yml` shipping two already-merged PRs while mainnet read 0.00 bps on
 * the same pair.
 *
 * So the matrix takes its own network: `SETI_PAR_NETWORK`, DEFAULTING TO the served one
 * so a laptop run is unchanged and the unit of the suite is still "the network this
 * process serves". CI sets it to `mainnet`, where the product runs. No band moved and
 * the ceiling still applies: the matrix is held to the measured band of the network it
 * now judges.
 *
 * A refused value is an ERROR rather than a fallback: a typo that silently reads the
 * served network is exactly the confusion this variable exists to end.
 */
function parNetwork(value: string | undefined, fallback: Network): Network {
  if (value === undefined || value === '') return fallback;
  if (value === 'mainnet' || value === 'testnet') return value;
  throw new Error(`SETI_PAR_NETWORK must be "mainnet" or "testnet", got "${value}"`);
}

const PAR_NETWORK: Network = parNetwork(process.env.SETI_PAR_NETWORK, NETWORK);

/**
 * The par band each pair is held to, in basis points, PER NETWORK: a MEASUREMENT
 * WITH A DATE, not a claim about how wide a spread is allowed to be.
 *
 * Measured on 2026-10-23 at 10.000000 units in, one quote per pair:
 *
 *     mainnet   pathusd ↔ ousd      0.00 bps
 *               ousd ↔ usdc.e       1.00 bps
 *               pathusd ↔ usdc.e    2.00 bps
 *               ousd ↔ usdt0        5.00 bps
 *               pathusd ↔ usdt0     6.00 bps
 *     practice  ousd ↔ pathusd      1.00 bps
 *
 * ...and the OTHER SIDE of two of those pairs, measured on 2026-11-03 at the same
 * size, three consecutive reads agreeing to the basis point:
 *
 *     mainnet   ousd → usdc.e       3.00 bps
 *               pathusd → usdc.e    3.00 bps
 *
 * Per network because the books are: practice carries one pair and quoted a basis
 * point off par on the day mainnet's native pair sat at zero. One number for both
 * would be a number that was never true of either.
 *
 * The native pair sits at (or near) zero because OUSD and pathUSD are one issuer's
 * dollar on one book. A BRIDGED asset is a different instrument: USDC.e and USDT0
 * arrive through a bridge, so their price carries the bridge's float and is wider.
 * USDT0 went from 1–2 bps on 2026-10-21 (`docs/operations.md` §9) to the 5–6 bps
 * above in two days — drift worth watching rather than a number that broke.
 *
 * One band for all five pairs was wrong, and wrong in a way CI could not see: it
 * read "at par within the measured spread (<= 2bps)", which only ever held on
 * practice, where USDT0 has no book at all and every USDT0 pair short-circuits
 * before the assertion (#202). A check that passes because the network it runs on
 * has nothing to quote is not a check.
 *
 * The keys are of two kinds, and the difference is load-bearing:
 *
 *  - `a↔b` is a PAIR band, taken in the direction the pair is written in
 *    `CONVERT_PAIRS`. It covers the other direction where that side was not measured
 *    separately, which is every pair here except the two rows below: the USDT0 sides
 *    that were measured are the ones with orders, and the sides that are empty today
 *    are reported rather than failed (#303).
 *  - `a→b` is a DIRECTION band, for a side that measured differently from its
 *    partner (`bandFor` prefers it). An AMM book can quote 1bps one way and 3bps the
 *    other because its mid sits a couple of basis points off par, so a single number
 *    for both sides would either pass a side nobody measured or go red on a book that
 *    had not moved. This is why the matrix below quotes each direction separately.
 *
 * A pair with no entry of either kind FAILS rather than defaulting: a band has to be
 * measured, not inherited.
 */
const MEASURED_ON = '2026-10-23';
/** The date the reverse sides of the bridged pairs were measured (see above). */
const MEASURED_REVERSE_ON = '2026-11-03';

const PAR_BAND_BPS: Readonly<Record<Network, Readonly<Record<string, number>>>> = {
  mainnet: {
    'ousd↔pathusd': 0,
    'ousd↔usdc.e': 1,
    'pathusd↔usdc.e': 2,
    'ousd↔usdt0': 5,
    'pathusd↔usdt0': 6,
    // The reverse sides of the two bridged pairs, measured on 2026-11-03 (the
    // numbers and their stability are in the docblock above). ADDED, not changed:
    // not one band above moved to make this suite green, and the pair rows still
    // cover every direction that was not measured separately.
    'ousd→usdc.e': 3,
    'pathusd→usdc.e': 3,
  },
  testnet: {
    'ousd↔pathusd': 1,
  },
};

/**
 * A live book moves between blocks, so a band is the measurement plus one basis
 * point: enough that a single tick is not read as drift, not enough to hide a real
 * move. It is a constant rather than a per-pair allowance on purpose, so the
 * headroom cannot be tuned pair by pair.
 */
const LIVE_BOOK_HEADROOM_BPS = 1;

/**
 * The widest band plus headroom any pair may be given. A pair is not allowed an
 * arbitrarily loose tolerance, so loosening the table above is a visible edit
 * against a limit instead of a quiet way to turn this suite green.
 */
const PAR_BAND_CEILING_BPS = 15;

/** `['usdt0','ousd']` and `['ousd','usdt0']` are the same book. */
function canonicalPair(a: string, b: string): string {
  return [a, b].sort().join('↔');
}

/**
 * The band a DIRECTION is held to: the direction's own measurement when one exists
 * (`'ousd→usdc.e'`), otherwise the pair's (`'ousd↔usdc.e'`).
 *
 * Direction first because the two sides of a book are not one price: the parent row is
 * the measurement taken in the direction the pair is written in `CONVERT_PAIRS`, and
 * using it for the other side is the fallback rather than the rule.
 */
function bandFor(assetIn: string, assetOut: string): number | undefined {
  return (
    PAR_BAND_BPS[PAR_NETWORK][`${assetIn}→${assetOut}`] ??
    PAR_BAND_BPS[PAR_NETWORK][canonicalPair(assetIn, assetOut)]
  );
}

/**
 * REPORT MODE, for a nightly job: the matrix only, then a summary, then exit 0.
 *
 * Read from the environment rather than a flag so `check:convert` stays the one
 * entry point, and read as the exact string `1` so a typo cannot quietly turn the
 * gate into a report.
 */
const BOOK_REPORT_MODE = process.env.CONVERT_BOOK_REPORT === '1';

/** The size every pair is quoted at, in token units: 10.000000, as measured. */
const BOOK_QUOTE_SIZE = BigInt(10_000_000);

/**
 * Column widths for the matrix. Wide enough for `report` and for the longest pair
 * on either allowlist (`pathusd → usdc.e`), so the status and the pair line up
 * down the block exactly as the arrow lines elsewhere in this file do.
 */
const BOOK_STATUS_WIDTH = 9;
const BOOK_PAIR_WIDTH = 20;

/**
 * One direction of one pair, as the book answered it.
 *
 * Both directions are kept, not just the one written in `CONVERT_PAIRS`, because a
 * market can hold orders on one side only: the venue has no bid for USDT0 on mainnet
 * on the day this was written, so `usdt0 → ousd` refuses while `ousd → usdt0` may
 * well quote. A reading that collapsed the two would be a claim about symmetry that
 * nobody measured.
 */
interface BookReading {
  readonly assetIn: SupportedAsset;
  readonly assetOut: SupportedAsset;
  readonly answer:
    | {
        readonly kind: 'quote';
        readonly amountOut: bigint;
        readonly minAmountOut: bigint;
        /** Against par, in whole basis points: the integer the band is judged on. */
        readonly spreadBps: number;
      }
    | { readonly kind: 'refused'; readonly code: string };
}

/**
 * Print one matrix line, and count it when it is an assertion.
 *
 * A `report` line is a REPORTED CONDITION and is deliberately neither a total nor a
 * failure: it says what a third party's book did, which this repository cannot fix.
 * `ok` and `FAIL` are ours, so they count.
 */
function matrixLine(status: 'ok' | 'report' | 'FAIL', pair: string, detail: string): void {
  console.log(`${status.padEnd(BOOK_STATUS_WIDTH)}${pair.padEnd(BOOK_PAIR_WIDTH)}${detail}`);
  if (status === 'report') return;
  total += 1;
  if (status === 'FAIL') failures += 1;
}

/** The refusal code the book gave, one line even when the driver's message is not. */
function bookRefusalCode(error: unknown): string {
  if (error instanceof ConvertRefusalError) return error.code;
  const message = error instanceof Error ? error.message : String(error);
  return `unexpected: ${message.split('\n')[0]}`;
}

/**
 * Hold one reading to its measured band, or report that the venue refused.
 *
 * The distinction this function exists to make:
 *
 *  - `convert-no-liquidity` is the market's answer. Reported, and never a failure.
 *  - any OTHER code is our mapping failing (an asset this network does not list, a
 *    pair we allow with no contracts behind it). Hard failure, because it will not
 *    fix itself by morning.
 *  - an answered quote outside `band + LIVE_BOOK_HEADROOM_BPS` is a hard failure: the
 *    book MOVED, and a customer would be quoted a price the product does not expect.
 *  - a pair with no band in `PAR_BAND_BPS` is a hard failure: there is no number to
 *    hold it to, and defaulting one would be inventing a tolerance.
 */
function judgeReading(reading: BookReading): void {
  const pair = `${reading.assetIn} → ${reading.assetOut}`;

  if (reading.answer.kind === 'refused') {
    const { code } = reading.answer;
    matrixLine(code === 'convert-no-liquidity' ? 'report' : 'FAIL', pair, `refused ${code}`);
    return;
  }

  const { spreadBps } = reading.answer;
  const measured = spreadBps.toFixed(2);
  const band = bandFor(reading.assetIn, reading.assetOut);

  if (band === undefined) {
    matrixLine('FAIL', pair, `${measured} bps, no entry in PAR_BAND_BPS`);
    return;
  }

  const allowed = band + LIVE_BOOK_HEADROOM_BPS;
  if (spreadBps > allowed) {
    matrixLine('FAIL', pair, `${measured} bps > ${allowed} bps allowed`);
    return;
  }

  matrixLine('ok', pair, `${measured} bps`);
}

/** Quote ONE direction, print its verdict, and return the reading for later sections. */
async function readDirection(
  assetIn: SupportedAsset,
  assetOut: SupportedAsset
): Promise<BookReading> {
  try {
    const quoted = await quoteDexConvert({
      assetIn,
      assetOut,
      amountIn: BOOK_QUOTE_SIZE,
      network: PAR_NETWORK,
    });

    // Integer basis points, the same arithmetic the band comparison uses, so the
    // figure printed is the figure judged: 2.0000000004 > 2 in floating point, and
    // a quote is integers all the way.
    const spreadBps = Number(
      ((BOOK_QUOTE_SIZE - quoted.amountOut) * BigInt(10_000)) / BOOK_QUOTE_SIZE
    );
    const reading: BookReading = {
      assetIn,
      assetOut,
      answer: {
        kind: 'quote',
        amountOut: quoted.amountOut,
        minAmountOut: quoted.minAmountOut,
        spreadBps,
      },
    };
    judgeReading(reading);
    return reading;
  } catch (error) {
    const reading: BookReading = {
      assetIn,
      assetOut,
      answer: { kind: 'refused', code: bookRefusalCode(error) },
    };
    judgeReading(reading);
    return reading;
  }
}

/**
 * The matrix: every pair on the allowlist, BOTH directions, one line each.
 *
 * This replaced a loop that quoted each pair once, in the direction the table
 * happened to be written, and turned any refusal into a failure. That loop reported
 * a third party's inventory as a defect in this repository, and it never once asked
 * what the other side of the book would pay (#303).
 */
async function scanBook(): Promise<BookReading[]> {
  const directions: Array<readonly [SupportedAsset, SupportedAsset]> = [];
  for (const [a, b] of CONVERT_PAIRS[PAR_NETWORK]) {
    directions.push([a, b], [b, a]);
  }

  const readings: BookReading[] = [];
  for (const [assetIn, assetOut] of directions) {
    readings.push(await readDirection(assetIn, assetOut));
  }
  return readings;
}

/**
 * The asset the route section's fixture row names, and therefore the input the funded
 * quote has to ask from: one wallet row per address, one `asset` label per row, and a
 * quote reads the balance of its input asset through that label.
 *
 * It is also the input of the `max` case below, which is why one row serves both: the
 * row sits at the DEX contract, whose pathUSD balance (7.86M on mainnet, 75.3bn on
 * practice) is far more than the OUSD side of the book can pay out.
 */
const FUNDED_ASSET: SupportedAsset = 'pathusd';

async function main(): Promise<void> {
  // The network, on the first line and unconditionally: every figure below is a
  // figure about ONE chain, and a matrix that does not say which book it read is a
  // matrix about nothing.
  console.log(`network: ${NETWORK} (${networkConfigFor(NETWORK).chainId})`);
  // The book being judged, which is NOT this process's network in CI: the par band is a
  // claim about where the product quotes, and the job runs on the testnet so nothing
  // reaches a mainnet endpoint (see `PAR_NETWORK`).
  console.log(`par bands: ${PAR_NETWORK} (${networkConfigFor(PAR_NETWORK).chainId})`);

  // -------------------------------------------------------------------------
  // (a) the book, as a matrix: every pair, BOTH directions, at 10.000000 in
  // -------------------------------------------------------------------------

  const book = await scanBook();

  // Report mode is finished here on purpose. It has printed what a nightly job
  // exists to print, and the sections below would open a database and a route to
  // assert things a report is not asserting.
  if (BOOK_REPORT_MODE) {
    const answered = book.filter((reading) => reading.answer.kind === 'quote').length;
    console.log(`summary: ${answered} answered, ${book.length - answered} refused`);
    return;
  }

  // The band table and the floor are OURS, so they are asserted whether or not the
  // book answered. A pair on the allowlist with no measured band is a hole in the
  // table rather than a market condition, and it used to go unnoticed exactly where
  // the book had nothing to quote (#202).
  const unmeasured = CONVERT_PAIRS[PAR_NETWORK]
    .flatMap(([a, b]) => [
      [a, b],
      [b, a],
    ] as const)
    .filter(([a, b]) => bandFor(a, b) === undefined)
    .map(([a, b]) => `${a} → ${b}`);
  check(
    `every direction on the ${PAR_NETWORK} allowlist has a measured par band (${MEASURED_ON}, reverse sides ${MEASURED_REVERSE_ON})`,
    unmeasured.length === 0,
    unmeasured.join(', ')
  );

  const widestBand = Math.max(...Object.values(PAR_BAND_BPS[PAR_NETWORK]));
  check(
    `the widest band given for ${PAR_NETWORK} plus ${LIVE_BOOK_HEADROOM_BPS}bp headroom is inside the ceiling (<= ${PAR_BAND_CEILING_BPS}bps)`,
    widestBand + LIVE_BOOK_HEADROOM_BPS <= PAR_BAND_CEILING_BPS,
    `${widestBand}bps`
  );

  // The floor is our arithmetic, not the book's: the quote less the tolerance the
  // route promises. One check per direction that answered, because a market that
  // refused has no floor to check.
  for (const reading of book) {
    if (reading.answer.kind !== 'quote') continue;
    const { amountOut, minAmountOut } = reading.answer;
    check(
      `${reading.assetIn} → ${reading.assetOut} floor is the quote less ${CONVERT_TOLERANCE_BPS}bps, never above the quote`,
      minAmountOut < amountOut &&
        minAmountOut === (amountOut * BigInt(10_000 - CONVERT_TOLERANCE_BPS)) / BigInt(10_000),
      `min ${(Number(minAmountOut) / 1_000_000).toFixed(6)}`
    );
  }

  // A size nobody should be able to fill on a thin book, to prove the refusal
  // path is reachable rather than theoretical. It stays an assertion even though
  // `convert-no-liquidity` is reported in the matrix above: this one asks whether the
  // refusal path exists at all, on whatever pair the allowlist names first, and a
  // venue that answered a trillion units would be the thing worth knowing.
  const absurd = await refusalOf(() =>
    quoteDexConvert({
      assetIn: CONVERT_PAIRS[NETWORK][0][0],
      assetOut: CONVERT_PAIRS[NETWORK][0][1],
      amountIn: BigInt('1000000000000000000'), // 1e12 units
      network: NETWORK,
    })
  );
  check('a size the book cannot fill is refused as no-liquidity', absurd === 'convert-no-liquidity', absurd);

  // -------------------------------------------------------------------------
  // (b) the allowlist is the measured book, not a permutation of four assets
  // -------------------------------------------------------------------------

  console.log(`\nallowlist (${NETWORK}):`);
  for (const [a, b] of CONVERT_PAIRS[NETWORK]) console.log(`     ${a} ↔ ${b}`);

  // This assertion used to read "usdt0 is offered on no network". It had a book on
  // mainnet by the evening of the same day, so the check now pins WHERE it is offered
  // rather than pretending it never is: mainnet yes, testnet no (unlisted there).
  check(
    'usdt0 is offered on mainnet, and only there',
    CONVERT_PAIRS.mainnet.some(([a, b]) => a === 'usdt0' || b === 'usdt0') &&
      !CONVERT_PAIRS.testnet.some(([a, b]) => a === 'usdt0' || b === 'usdt0')
  );
  // The label says CONFIG on purpose: this asserts that the allowlist accepts both
  // directions of every pair, which is a fact about `isAllowedPair`. It says nothing
  // about the book, and the matrix at the top is the only place that asks the book
  // (#303): a market can hold orders on one side and refuse the other.
  check(
    'the allowlist is symmetric in config, which says nothing about the book',
    CONVERT_PAIRS[NETWORK].every(([a, b]) => isAllowedPair(a, b, NETWORK) && isAllowedPair(b, a, NETWORK))
  );
  check(
    'a pair with no measured book is refused even though both assets are supported',
    // `usdt0 ↔ pathusd` is on mainnet's list; on testnet it is not, and that is the
    // unlisted-pair case. Derive from the served network rather than hardcode it.
    NETWORK === 'testnet'
      ? isAllowedPair('usdt0', 'pathusd', NETWORK) === false
      : isAllowedPair('usdt0', 'pathusd', NETWORK) === true
  );

  // The destination a balance row offers is the destination settlement aims at, because
  // it is one product decision made once (OUSD is the asset to hold). If one of them is
  // changed alone, a customer's row and the settlement pass would hold different assets.
  check(
    'the row target and the settlement target are the same asset',
    CONVERT_ROW_TARGET === SETTLE_TARGET,
    `${CONVERT_ROW_TARGET} vs ${SETTLE_TARGET}`
  );

  // -------------------------------------------------------------------------
  // (c) refusals that must not need a chain or a database
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
  // (d) the amount a balance can actually swap — the money rule, no chain
  // -------------------------------------------------------------------------
  //
  // Gas is charged in the token being spent on Tempo, so the amount that may be
  // signed is the balance LESS the fee. Signing the whole balance reverts on chain
  // with a perfectly good quote (#105), which is why this is decided on the server
  // and proven here without a wallet.
  console.log('\nwhat a balance can swap:');

  const balance = parseUnits('10', ASSET_DECIMALS);
  const gas = parseUnits('0.05', ASSET_DECIMALS);

  const maxSwap = resolveConvertAmount({ amountIn: CONVERT_AMOUNT_MAX, balance, gas });
  check(
    `"max" is the balance less the network fee (10 - 0.05 = 9.95)`,
    maxSwap.ok && maxSwap.amountIn === parseUnits('9.95', ASSET_DECIMALS),
    maxSwap.ok ? String(maxSwap.amountIn) : maxSwap.code
  );
  check(
    'and "MAX" in capitals is the same word, because a client may shout it',
    resolveConvertAmount({ amountIn: 'MAX', balance, gas }).ok
  );

  const exactFit = resolveConvertAmount({
    amountIn: '9.95',
    balance,
    gas,
  });
  check(
    'the whole spendable balance is allowed, to the unit',
    exactFit.ok && exactFit.amountIn === parseUnits('9.95', ASSET_DECIMALS),
    exactFit.ok ? String(exactFit.amountIn) : exactFit.code
  );

  const noRoomForGas = resolveConvertAmount({ amountIn: '10', balance, gas });
  check(
    'an amount that leaves no room for the fee is insufficient, not signed and reverted',
    !noRoomForGas.ok && noRoomForGas.code === 'convert-insufficient-balance',
    noRoomForGas.ok ? 'accepted' : noRoomForGas.code
  );

  for (const [label, amount] of [
    ['zero', '0'],
    ['negative', '-5'],
    ['non-numeric', 'lots'],
    ['empty', ' '],
    ['finer than the token carries', '1.0000001'],
    ['scientific notation', '1e-3'],
  ] as const) {
    const result = resolveConvertAmount({ amountIn: amount, balance, gas });
    check(
      `an amount that is ${label} ("${amount}") is refused as convert-amount-invalid`,
      !result.ok && result.code === 'convert-amount-invalid',
      result.ok ? 'accepted' : result.code
    );
  }

  check(
    'a balance that the fee alone would consume cannot be swapped at all',
    (() => {
      const drained = resolveConvertAmount({
        amountIn: CONVERT_AMOUNT_MAX,
        balance: parseUnits('0.01', ASSET_DECIMALS),
        gas,
      });
      return !drained.ok && drained.code === 'convert-insufficient-balance';
    })()
  );

  // -------------------------------------------------------------------------
  // (e) the quote route: the five refusals as CODES, over HTTP
  // -------------------------------------------------------------------------
  //
  // Driven through the REAL route, with the real auth guard, because the schema is
  // where a refusal code is lost: a `z.enum` for the assets would turn "dai" into a
  // generic 400 before the service could answer, and only a request proves which
  // one this route really says.
  //
  // The funded case needs a balance, and a check cannot sign a swap. So the fixture
  // wallet points at the DEX CONTRACT, which holds a real balance of every token on
  // both chains (measured on practice 2026-10-26: 50,536 OUSD, 75.3bn pathUSD). That
  // address is protocol-owned and permanent, unlike a faucet drip to a stranger,
  // which would make the suite's verdict depend on what happened to be funded that
  // hour. No ledger row is ever written: a quote is a read.
  console.log('\nquote route (POST /transactions/convert/quote):');

  // Loaded HERE rather than at the top of the file: report mode must not open a
  // database or register a route, so Prisma, the error handler and the router exist
  // only on the path that drives them.
  const [{ default: Fastify }, { prisma }, { apiErrorHandler }, { transactionRoutes }] =
    await Promise.all([
      import('fastify'),
      import('../lib/prisma.js'),
      import('../server.js'),
      import('../routes/transactions.js'),
    ]);

  const app: FastifyInstance = Fastify();
  app.setErrorHandler(apiErrorHandler);
  await app.register(transactionRoutes, { prefix: '/transactions' });
  await app.ready();

  const ask = (body: Record<string, string>) =>
    app.inject({
      method: 'POST',
      url: '/transactions/convert/quote',
      payload: body as never,
    });

  /** The refusal CODE a response carried, or its status when it carried none. */
  const codeOf = (response: { statusCode: number; body: string; json: <T>() => T }): string => {
    const body = response.json<{ code?: string }>();
    return body.code ?? `status-${response.statusCode}`;
  };

  const devUser = await prisma.user.upsert({
    where: { email: 'dev@seti.test' },
    update: {},
    create: { email: 'dev@seti.test' },
  });

  // A leftover from a suite that crashed mid-run would silently change the balance
  // this file measures, so the fixture is removed before it is created as well.
  const clearFixture = () =>
    prisma.wallet.deleteMany({ where: { userId: devUser.id, address: STABLECOIN_DEX_ADDRESS } });
  await clearFixture();

  const quotesBefore = await prisma.transaction.count({
    where: { userId: devUser.id, type: 'convert' },
  });

  try {
    const [pairIn, pairOut] = outsidePairs[0] ?? [listed[0], listed[1]];
    const pairRefusal = await ask({ assetIn: pairIn, assetOut: pairOut, amountIn: '10' });
    check(
      `a listed pair with no market (${pairIn} → ${pairOut}) is refused as convert-pair-unavailable`,
      pairRefusal.statusCode === 422 && codeOf(pairRefusal) === 'convert-pair-unavailable',
      `${pairRefusal.statusCode} ${codeOf(pairRefusal)}`
    );

    const same = await ask({ assetIn: listed[0], assetOut: listed[0], amountIn: '10' });
    check(
      'the same asset in and out is refused as convert-same-asset',
      same.statusCode === 422 && codeOf(same) === 'convert-same-asset',
      `${same.statusCode} ${codeOf(same)}`
    );

    // The boundary is loose so this could answer at all: an enum here would say 400.
    const unknown = await ask({ assetIn: 'dai', assetOut: 'ousd', amountIn: '10' });
    check(
      'an asset this product does not support is refused as convert-unknown-asset',
      unknown.statusCode === 422 && codeOf(unknown) === 'convert-unknown-asset',
      `${unknown.statusCode} ${codeOf(unknown)}`
    );
    if (foreign) {
      const unlisted = await ask({ assetIn: foreign, assetOut: listed[0], amountIn: '10' });
      check(
        `an asset this network does not list (${foreign}) is refused as convert-unknown-asset`,
        unlisted.statusCode === 422 && codeOf(unlisted) === 'convert-unknown-asset',
        `${unlisted.statusCode} ${codeOf(unlisted)}`
      );
    }

    for (const [label, amount] of [
      ['a zero amount', '0'],
      ['a non-numeric amount', 'lots'],
      ['an amount finer than the token carries', '0.0000001'],
      ['scientific notation, which is not an amount a person types', '1e5'],
    ] as const) {
      const response = await ask({ assetIn: listed[0], assetOut: listed[1], amountIn: amount });
      check(
        `${label} ("${amount}") is refused as convert-amount-invalid`,
        response.statusCode === 422 && codeOf(response) === 'convert-amount-invalid',
        `${response.statusCode} ${codeOf(response)}`
      );
    }

    // More than any account on either chain could hold in this asset, so the refusal
    // is about the balance and cannot accidentally be about the book.
    const short = await ask({ assetIn: 'ousd', assetOut: 'pathusd', amountIn: '1000000000' });
    check(
      'an amount the balance cannot cover is refused as convert-insufficient-balance',
      short.statusCode === 422 && codeOf(short) === 'convert-insufficient-balance',
      `${short.statusCode} ${codeOf(short)}`
    );

    // The funded quote asks a pair the MATRIX above actually answered, and one whose
    // INPUT is `pathusd`, because that is the only label the one fixture row this
    // account can hold may carry. Two constraints decide that, and both are already in
    // the code: `Wallet.address` is unique, so the single row at the DEX CONTRACT names
    // exactly one asset, and a quote reads the balance of its INPUT asset through that
    // label (`getUserBalance`). A pair on any other input reads whichever wallet the
    // account happens to hold, which on mainnet is a placeholder holding nothing.
    //
    // Before this the pair was `[listed[0], listed[1]]`, whose book is empty on
    // mainnet, so the route answered about the market while the check believed it was
    // asking about the route (#303). When no fundable pair answered there is nothing to
    // ask, and a skip that says why is more honest than a failure about inventory.
    const funded = book.find(
      (reading) => reading.answer.kind === 'quote' && reading.assetIn === FUNDED_ASSET
    );
    const fundedOut = funded?.assetOut;

    // ---- now with a balance to quote against ----
    // The row points at the DEX CONTRACT, which holds a real balance of every token on
    // both chains (mainnet today: 5.99M OUSD, 7.86M pathUSD, 1.31M USDC.e, 1.59M
    // USDT0). That address is protocol-owned and permanent, unlike a faucet drip to a
    // stranger, which would make the suite's verdict depend on what was funded that hour.
    await prisma.wallet.create({
      data: {
        userId: devUser.id,
        chain: 'tempo',
        asset: FUNDED_ASSET,
        address: STABLECOIN_DEX_ADDRESS,
        network: NETWORK,
        status: 'active',
      },
    });

    const ok = fundedOut
      ? await ask({ assetIn: FUNDED_ASSET, assetOut: fundedOut, amountIn: '10' })
      : null;
    if (ok) {
      check(
        'a pair with a book quotes 200',
        ok.statusCode === 200,
        `${FUNDED_ASSET} → ${fundedOut}: ${ok.statusCode} ${codeOf(ok)}`
      );
    } else {
      console.log(
        `skip  no ${FUNDED_ASSET} pair answered the book at 10.000000 on ${NETWORK}, so the fixture can fund no pair with a book to quote through the route`
      );
    }
    const quoted = ok && ok.statusCode === 200 ? ok.json<{ quote: ConvertQuote }>().quote : null;

    if (quoted) {
      const out = parseUnits(quoted.amountOut, ASSET_DECIMALS);
      const floor = parseUnits(quoted.minAmountOut, ASSET_DECIMALS);
      check(
        'the quote answers the amount in, the amount out and the floor',
        quoted.amountIn === '10' && out > BigInt(0) && floor > BigInt(0),
        `${quoted.amountIn} → ${quoted.amountOut}, floor ${quoted.minAmountOut}`
      );
      check(
        `the floor is the quote less ${CONVERT_TOLERANCE_BPS}bps, exactly`,
        floor === (out * BigInt(10_000 - CONVERT_TOLERANCE_BPS)) / BigInt(10_000) &&
          quoted.toleranceBps === CONVERT_TOLERANCE_BPS,
        `${quoted.minAmountOut} of ${quoted.amountOut}`
      );
      check(
        'the network fee is a real figure in the input token, not a placeholder',
        Number(quoted.networkFee) > 0 && Number(quoted.networkFee) < Number(quoted.amountIn),
        `${quoted.networkFee} ${quoted.assetIn} (${quoted.networkFeeSource})`
      );
      check('the quote names the network it priced', quoted.network === NETWORK, quoted.network);
      // The record path refuses a convert without a frozen rate, so the quote id has
      // to be one `readQuote` accepts for THIS account on THIS network.
      const frozen = readQuote(quoted.quoteId, devUser.id, NETWORK);
      check(
        'the quote id is a frozen rate this account can record with',
        frozen.fiatPerUsd > 0,
        `${frozen.fiatCurrency} at ${frozen.fiatPerUsd}`
      );
      const notYours = await (async () => {
        try {
          readQuote(quoted.quoteId, 'someone-else', NETWORK);
          return 'accepted';
        } catch (error) {
          return (error as { code?: string }).code ?? 'unreadable';
        }
      })();
      check('and it is not usable by another account', notYours === 'quote-not-yours', notYours);
    }

    // The whole balance is more than the book can fill: on practice the DEX address
    // holds 75.3bn pathUSD against a thin OUSD side, and on mainnet 7.86M pathUSD left
    // the same ask unquotable. `quoteSwapExactAmountIn` reverts rather than
    // part-filling. This is the case that HIDES the control on a row, and the fixture
    // row above already names `pathusd`, so `max` reads the balance it means.
    const noBook = await ask({ assetIn: FUNDED_ASSET, assetOut: 'ousd', amountIn: 'max' });
    check(
      'a size the book cannot fill is refused as convert-no-liquidity',
      noBook.statusCode === 422 && codeOf(noBook) === 'convert-no-liquidity',
      `${noBook.statusCode} ${codeOf(noBook)}`
    );
  } finally {
    await clearFixture();
    await app.close();
  }

  const quotesAfter = await prisma.transaction.count({
    where: { userId: devUser.id, type: 'convert' },
  });
  check(
    'no quote wrote a row: asking what a swap would pay is a read',
    quotesAfter === quotesBefore,
    `${quotesBefore} → ${quotesAfter}`
  );

  console.log('-'.repeat(74));
  console.log(
    failures === 0 ? `All ${total} checks passed.` : `${failures} of ${total} checks FAILED.`
  );
  if (failures > 0) process.exit(1);
}

void main();
