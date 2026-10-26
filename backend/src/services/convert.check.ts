/**
 * The convert quote: pairs, refusals, the slippage bound, and the book.
 *
 * Run with:  npx tsx src/services/convert.check.ts
 * (or `npm run check:convert` from the repo root.)
 *
 * Four halves, and the split is the point:
 *
 *  1. HERMETIC. Every refusal that must happen before the chain or the database
 *     is touched is asserted here with no Postgres, no wallet and no network —
 *     because those are the answers the app switches on, and a refusal that
 *     needed a database to be reached would be a 500 in production instead.
 *  2. LIVE. The book itself is read from the DEX precompile on the network this
 *     deployment serves, and each quote is asserted to sit inside the par band
 *     MEASURED for that pair (`PAR_BAND_BPS` below, with the date it was taken).
 *     This half is what fails if the venue changes shape, the precompile moves, or
 *     someone widens the allowlist to a pair with no orders.
 *  3. THE AMOUNT RULE (`resolveConvertAmount`), pure: how much of a balance may be
 *     signed, which is the balance less gas because Tempo charges the fee in the
 *     token being spent. Signing the whole balance reverts on chain (#105).
 *  4. THE QUOTE ROUTE, over HTTP with the real auth guard: the five refusals #240
 *     names, each with its own code, plus one successful quote and the assertion
 *     that asking wrote no row. The schema is where a refusal code is lost — a
 *     `z.enum` for the assets answers 400 where the app expects
 *     `convert-unknown-asset` — so the route is driven rather than described.
 *
 * What it deliberately does NOT do: sign, record, or write. A quote is a read, and
 * a suite that moved money to prove one would be proving the wrong thing. The
 * record path is proved by `check:convert-record` against a real swap receipt.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { parseUnits } from 'viem';
import {
  CONVERT_AMOUNT_MAX,
  CONVERT_PAIRS,
  CONVERT_TOLERANCE_BPS,
  ConvertRefusalError,
  isAllowedPair,
  previewConvert,
  quoteDexConvert,
  resolveConvertAmount,
  type ConvertQuote,
} from './convert.js';
import { STABLECOIN_DEX_ADDRESS, networkConfigFor, servedNetwork } from './chain.js';
import { ASSET_DECIMALS, SUPPORTED_ASSETS } from '../config/assets.js';
import { readQuote } from './quote.js';
import { prisma } from '../lib/prisma.js';
import { apiErrorHandler } from '../server.js';
import { transactionRoutes } from '../routes/transactions.js';
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
 * Keys are order-insensitive (`canonicalPair`) so one row covers both directions,
 * and a pair with no entry FAILS rather than defaulting: a band has to be measured,
 * not inherited.
 */
const MEASURED_ON = '2026-10-23';

const PAR_BAND_BPS: Readonly<Record<Network, Readonly<Record<string, number>>>> = {
  mainnet: {
    'ousd↔pathusd': 0,
    'ousd↔usdc.e': 1,
    'pathusd↔usdc.e': 2,
    'ousd↔usdt0': 5,
    'pathusd↔usdt0': 6,
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

async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  // (a) the allowlist is the measured book, not a permutation of four assets
  // -------------------------------------------------------------------------

  console.log(`allowlist (${NETWORK}):`);
  for (const [a, b] of CONVERT_PAIRS[NETWORK]) console.log(`     ${a} ↔ ${b}`);

  // This assertion used to read "usdt0 is offered on no network". It had a book on
  // mainnet by the evening of the same day, so the check now pins WHERE it is offered
  // rather than pretending it never is: mainnet yes, testnet no (unlisted there).
  check(
    'usdt0 is offered on mainnet, and only there',
    CONVERT_PAIRS.mainnet.some(([a, b]) => a === 'usdt0' || b === 'usdt0') &&
      !CONVERT_PAIRS.testnet.some(([a, b]) => a === 'usdt0' || b === 'usdt0')
  );
  check(
    'the allowlist is symmetric: a pair can be converted in either direction',
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
      // Integer basis points, so the bound cannot fail on a float artefact:
      // 2.0000000004 > 2 in floating point, and a quote is integers all the way.
      const spreadBps = Number(
        ((BigInt(10_000_000) - quoted.amountOut) * BigInt(10_000)) / BigInt(10_000_000)
      );

      const band = PAR_BAND_BPS[NETWORK][canonicalPair(a, b)];
      const allowed = band === undefined ? 0 : band + LIVE_BOOK_HEADROOM_BPS;

      check(`${a} → ${b} quotes`, quoted.amountOut > 0n, `${out.toFixed(6)} out`);
      // A pair with no measured band is a FAILURE, not a pass with a default: the
      // number below has to come from a quote somebody took, or this suite would
      // hold a new pair to a tolerance nobody chose.
      check(
        `${a} → ${b} has a par band measured on ${MEASURED_ON}`,
        band !== undefined,
        band === undefined ? 'no entry in PAR_BAND_BPS' : `<= ${band}bps`
      );
      check(
        `${a} → ${b} is inside its measured band (${band ?? 0}bps + ${LIVE_BOOK_HEADROOM_BPS}bp headroom, measured ${MEASURED_ON})`,
        spreadBps <= allowed,
        `${spreadBps.toFixed(2)}bps`
      );
      check(
        `the band for ${a} → ${b} is inside the ceiling (<= ${PAR_BAND_CEILING_BPS}bps)`,
        allowed <= PAR_BAND_CEILING_BPS,
        `${allowed}bps`
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

    // ---- now with a balance to quote against ----
    await prisma.wallet.create({
      data: {
        userId: devUser.id,
        chain: 'tempo',
        asset: 'pathusd',
        address: STABLECOIN_DEX_ADDRESS,
        network: NETWORK,
        status: 'active',
      },
    });

    const ok = await ask({ assetIn: 'ousd', assetOut: 'pathusd', amountIn: '10' });
    const quoted = ok.statusCode === 200 ? ok.json<{ quote: ConvertQuote }>().quote : null;
    check('a pair with a book quotes 200', ok.statusCode === 200, `${ok.statusCode} ${codeOf(ok)}`);

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

    // The whole balance is more than the book can fill: the DEX holds 75.3bn pathUSD
    // against an OUSD inventory of ~50k, and `quoteSwapExactAmountIn` reverts rather
    // than part-filling. This is the case that HIDES the control on a row.
    const noBook = await ask({ assetIn: 'pathusd', assetOut: 'ousd', amountIn: 'max' });
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
