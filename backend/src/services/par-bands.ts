/**
 * The par bands: how wide a swap's spread against par may be, per direction.
 *
 * ## Why this is its own module
 *
 * These numbers are read by two things that must never disagree: the `check:convert`
 * gate, which fails a merge, and the nightly book report, which prints what a third
 * party's book did. The gate could not import the report and the report could not
 * import the gate, because both lived inside a suite that reaches `config/env.ts` at
 * import — and a read job has no business being handed a database URL and a JWT
 * secret to measure a spread (#493).
 *
 * So the numbers live here, with no imports beyond a type, and both callers import
 * them. A band that changed in one place and not the other is the failure this file
 * exists to make impossible.
 *
 * ## What a band is
 *
 * A measurement with a date on it, taken in ONE direction of one book, at the size the
 * suite quotes. The two sides of a book are not one price: an AMM can quote 1bps one
 * way and 3bps the other because its mid sits a couple of basis points off par. A pair
 * with no entry of either kind is a hole rather than a market condition, and both
 * callers treat it as one.
 */
import type { Network } from '../lib/network.js';

/** The date the pair-side bands were measured. */
export const MEASURED_ON = '2026-10-23';

/** The date the reverse sides of the bridged pairs were measured. */
export const MEASURED_REVERSE_ON = '2026-11-03';

/**
 * The date the USDT0 side of the OUSD book was measured, after it widened off par (#517).
 *
 * Its own constant rather than a re-date of `MEASURED_ON`, because the pair edges taken
 * then are still what the other side is held to, and moving the date under all of them
 * would say they were measured again. They were not.
 */
export const MEASURED_USDT0_SIDE_ON = '2026-11-10';

/**
 * The date the USDC.e side of both native books was measured, after it widened off par (#565).
 *
 * Its own constant for the reason the USDT0 one has one: the pair edges and the reverse rows
 * taken before this date are still what their own sides are held to, and re-dating them would
 * claim they were measured again. They were not.
 */
export const MEASURED_USDC_E_SIDE_ON = '2026-11-11';

/**
 * Spread against par, in basis points, keyed `'a↔b'` for a pair measurement and
 * `'a→b'` for one direction of it.
 *
 * The direction rows EXIST because the reverse side of a bridged pair does not quote
 * the same as the side the pair is written in. They were added, never substituted: not
 * one pair row moved to make room for them.
 */
export const PAR_BAND_BPS: Readonly<Record<Network, Readonly<Record<string, number>>>> = {
  mainnet: {
    'ousd↔pathusd': 0,
    'ousd↔usdc.e': 1,
    'pathusd↔usdc.e': 2,
    'ousd↔usdt0': 5,
    'pathusd↔usdt0': 6,
    // The reverse sides of the two bridged pairs, measured on MEASURED_REVERSE_ON.
    'ousd→usdc.e': 3,
    'pathusd→usdc.e': 3,
    // The USDT0 side of the OUSD book, measured on MEASURED_USDT0_SIDE_ON. The pair edge
    // is 5 and the book quit quoting near it: four readings in a row, the CI gate among
    // them, held at 14.00 bps while the reverse side sat at -7 to -9 (#517).
    'usdt0→ousd': 14,
    // The same move on the other book: `pathusd↔usdt0` measured 6, and this side reads
    // 14.00 on the same day, while `pathusd→usdt0` reads -8. One token, two books, the same
    // sell side (#525).
    'usdt0→pathusd': 14,
    // The USDC.e side of both native books, measured on MEASURED_USDC_E_SIDE_ON: two
    // readings forty minutes apart, agreeing to the basis point (#565). Both sell
    // sides read 5.00 while the buy sides sat at 0.00 and 1.00 on the same book, and
    // exactly 5.00 twice is a resting offer a few basis points above par rather than a book
    // drifting: nothing in this repository prices a swap, the chain's own
    // `quoteSwapExactAmountIn` does, and the only number applied to its answer is the 50bps
    // tolerance behind `minAmountOut`. The pair rows stay where they are, because the side
    // they were measured on still reads at par.
    'usdc.e→ousd': 5,
    'usdc.e→pathusd': 5,
  },
  testnet: {
    'ousd↔pathusd': 1,
  },
};

/**
 * A live book moves between blocks, so a band is the measurement plus one basis point:
 * enough that a single tick is not read as drift, not enough to hide a real move. A
 * constant rather than a per-pair allowance, so it cannot be tuned pair by pair.
 */
export const LIVE_BOOK_HEADROOM_BPS = 1;

/**
 * The widest band plus headroom any pair may be given, so loosening the table above is
 * a visible edit against a limit rather than a quiet way to turn the gate green.
 */
export const PAR_BAND_CEILING_BPS = 15;

/** `['usdt0','ousd']` and `['ousd','usdt0']` are the same book. */
export function canonicalPair(a: string, b: string): string {
  return [a, b].sort().join('↔');
}

/**
 * The band a DIRECTION is held to on one network: the direction's own measurement when
 * one exists (`'ousd→usdc.e'`), otherwise the pair's (`'ousd↔usdc.e'`).
 *
 * Direction first because the two sides of a book are not one price: the pair row is
 * the measurement taken in the direction the pair is written in `CONVERT_PAIRS`, and
 * using it for the other side is the fallback rather than the rule.
 */
export function bandFor(network: Network, assetIn: string, assetOut: string): number | undefined {
  return (
    PAR_BAND_BPS[network][`${assetIn}→${assetOut}`] ??
    PAR_BAND_BPS[network][canonicalPair(assetIn, assetOut)]
  );
}
