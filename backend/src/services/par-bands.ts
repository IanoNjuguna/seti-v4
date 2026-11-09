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
