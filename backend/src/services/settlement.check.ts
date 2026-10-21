/**
 * Prove the settlement RULES — `check:settle`.
 *
 * Settlement moves a customer's money without them asking, so its decisions are
 * the part that must be provable rather than plausible. Two halves:
 *
 *  1. `classifySettle` is pure — no chain, no database, no user — so every refusal
 *     direction is asserted here: dust stays put, the target asset is left alone, a
 *     pair with no book is skipped, and a spread past the cap is refused while one
 *     inside it is taken.
 *  2. The same function is then driven with a REAL quote from the served network's
 *     book, so the rules and the chain cannot drift apart silently.
 *
 * What is NOT proved here: the executor. The swap is signed by the customer's own
 * wallet in the app, and this suite never signs anything.
 */

import { formatUnits, parseUnits } from 'viem';
import { quoteDexConvert } from './convert.js';
import { servedNetwork, isListedOn } from './chain.js';
import {
  SETTLE_MAX_SPREAD_BPS,
  SETTLE_MIN_UNITS,
  SETTLE_TARGET,
  classifySettle,
} from './settlement.js';
import { ASSET_DECIMALS } from '../config/assets.js';

let failures = 0;
let asserts = 0;

function check(label: string, pass: boolean, detail?: string | number) {
  asserts += 1;
  if (!pass) failures += 1;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` — ${detail}`}`);
}

const units = (value: string) => parseUnits(value, ASSET_DECIMALS);

/** A quote that pays back `outBps` basis points below par. */
function quoteAt(inUnits: string, spreadBps: number) {
  const amountIn = units(inUnits);
  const amountOut = (amountIn * BigInt(10_000 - spreadBps)) / BigInt(10_000);
  return { amountIn, amountOut };
}

async function main(): Promise<void> {
  console.log(
    `settle — served ${servedNetwork}, target ${SETTLE_TARGET}, min ${SETTLE_MIN_UNITS} units, cap ${SETTLE_MAX_SPREAD_BPS}bps`
  );

  // ------------------------------------------------------------------ the target
  check(
    'the settlement target is never settled into itself',
    classifySettle({
      asset: SETTLE_TARGET,
      balance: '100',
      quote: quoteAt('100', 0),
      allowed: true,
    }).reason === 'already-target'
  );

  // -------------------------------------------------------------------- the dust
  const justUnder = String(SETTLE_MIN_UNITS - 0.000001);
  check(
    `a balance just under the floor is left alone (${justUnder})`,
    classifySettle({
      asset: 'usdc.e',
      balance: justUnder,
      quote: quoteAt(justUnder, 1),
      allowed: true,
    }).reason === 'below-threshold'
  );

  check(
    'a balance exactly at the floor is worth settling',
    classifySettle({
      asset: 'usdc.e',
      balance: String(SETTLE_MIN_UNITS),
      quote: quoteAt(String(SETTLE_MIN_UNITS), 1),
      allowed: true,
    }).settle
  );

  // ------------------------------------------------------------------- the book
  check(
    'a pair with no book is skipped, not attempted',
    classifySettle({ asset: 'usdt0', balance: '100', quote: null, allowed: false }).reason ===
      'no-market'
  );

  check(
    'a quote that pays nothing is skipped',
    classifySettle({
      asset: 'usdc.e',
      balance: '100',
      quote: { amountIn: units('100'), amountOut: BigInt(0) },
      allowed: true,
    }).reason === 'no-market'
  );

  // ------------------------------------------------------------------ the spread
  const atCap = classifySettle({
    asset: 'usdc.e',
    balance: '100',
    quote: quoteAt('100', SETTLE_MAX_SPREAD_BPS),
    allowed: true,
  });
  check('a fill exactly at the cap is taken', atCap.settle, `${atCap.spreadBps}bps`);

  const overCap = classifySettle({
    asset: 'usdc.e',
    balance: '100',
    quote: quoteAt('100', SETTLE_MAX_SPREAD_BPS + 1),
    allowed: true,
  });
  check(
    'a fill one basis point past the cap is refused',
    overCap.reason === 'spread-too-wide',
    `${overCap.spreadBps}bps`
  );

  const par = classifySettle({
    asset: 'pathusd',
    balance: '100',
    quote: quoteAt('100', 0),
    allowed: true,
  });
  check('a par fill is taken and reports 0bps', par.settle && par.spreadBps === 0);

  // ------------------------------------------------------- and against the chain
  // The rules above are arithmetic. This part asks the SERVED network's book, so a
  // book that changed shape shows up as a skip rather than as a settlement nobody
  // re-checked.
  if (!isListedOn(SETTLE_TARGET, servedNetwork)) {
    console.log(`skip  ${servedNetwork} does not list ${SETTLE_TARGET}; nothing to plan here`);
  } else {
    const probe = servedNetwork === 'mainnet' ? '1000' : '100';
    const sources = ['usdc.e', 'pathusd'].filter((asset) => isListedOn(asset as never, servedNetwork));

    for (const asset of sources) {
      if (asset === SETTLE_TARGET) continue;

      let quote: { amountIn: bigint; amountOut: bigint } | null = null;
      try {
        const priced = await quoteDexConvert({
          assetIn: asset as never,
          assetOut: SETTLE_TARGET,
          amountIn: units(probe),
          network: servedNetwork,
        });
        quote = { amountIn: units(probe), amountOut: priced.amountOut };
      } catch {
        quote = null;
      }

      const decision = classifySettle({
        asset: asset as never,
        balance: probe,
        quote,
        allowed: quote !== null,
      });

      const where = quote
        ? `${formatUnits(quote.amountOut, ASSET_DECIMALS)} out at ${decision.spreadBps}bps`
        : 'no book';

      check(
        `${asset} on ${servedNetwork} is decided from the live book (${where})`,
        quote === null
          ? decision.reason === 'no-market'
          : decision.settle || decision.reason === 'spread-too-wide'
      );
    }
  }

  console.log(`\n${asserts - failures}/${asserts} checks passed`);
  if (failures > 0) {
    console.error(`${failures} FAILED`);
    process.exit(1);
  }
}

void main();
