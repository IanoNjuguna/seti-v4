/**
 * Which pairs this product will convert, per network.
 *
 * ## What this table is
 *
 * An ALLOWLIST, not a list of what the book will fill. A pair here means the product
 * is willing to convert that way; whether it fills is the venue's answer, asked at
 * quote time and refused with `convert-no-liquidity` when there are no orders. The
 * two are deliberately separate: this table is a measurement with a date on it, and
 * `GET /transactions/convert/pairs` publishes the book's own answer beside it (#496).
 *
 * `isAllowedPair` accepts either side of an entry, so writing one pair offers both
 * directions. That is safe only because a direction with no orders refuses cleanly.
 *
 * ## Why it is its own module
 *
 * It is a constant, but it lived in `services/convert.ts`, which reaches
 * `config/env.ts` at import. The nightly book report needs this table and must not
 * need an environment to read a book (#493), so the table moved here with no imports
 * beyond types. `convert.ts` re-exports it, so every existing import keeps working.
 */
import type { Network } from '../lib/network.js';
import type { SupportedAsset } from '../config/assets.js';

export const CONVERT_PAIRS: Record<Network, ReadonlyArray<readonly [SupportedAsset, SupportedAsset]>> = {
  mainnet: [
    ['usdc.e', 'ousd'],
    ['pathusd', 'ousd'],
    ['usdc.e', 'pathusd'],
    ['usdt0', 'ousd'],
    ['usdt0', 'pathusd'],
  ],
  testnet: [['ousd', 'pathusd']],
};
