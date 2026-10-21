/**
 * The pairs this build will offer, per chain.
 *
 * A mirror of `CONVERT_PAIRS` in `backend/src/services/convert.ts`, and the
 * reason it exists on this side at all: the pickers must not OFFER a pair the
 * server will refuse. The book is thin and unordered, so "every combination of
 * four assets" is not the offer — `usdt0` has no market in either direction on
 * either network, and offering it would be a button that fails after the customer
 * has typed an amount.
 *
 * The backend is still the authority: this list can only make the UI narrower
 * than the server, never wider, and a pair that slips through is refused with a
 * code the page renders (`convert-pair-unavailable`).
 */
import { TEMPO_MAINNET_CHAIN_ID, TEMPO_TESTNET_CHAIN_ID, type SupportedAsset } from '@/lib/chain';

type Pair = readonly [SupportedAsset, SupportedAsset];

/** Measured on 2026-10-20/21, in the direction the book was measured. */
export const CONVERT_PAIRS_BY_CHAIN: Readonly<Record<number, readonly Pair[]>> = {
  [TEMPO_MAINNET_CHAIN_ID]: [
    ['usdc.e', 'ousd'],
    ['pathusd', 'ousd'],
    ['usdc.e', 'pathusd'],
  ],
  // Practice has one book: 10 in, 9.999 out.
  [TEMPO_TESTNET_CHAIN_ID]: [['ousd', 'pathusd']],
};

/** The pairs a chain can convert between, in display order. */
export function convertPairsFor(chainId: number): readonly Pair[] {
  return CONVERT_PAIRS_BY_CHAIN[chainId] ?? [];
}

/**
 * What `assetIn` can be converted into on this chain.
 *
 * Read in both directions of every pair, and de-duplicated in table order: the
 * book accepts either side, so `['usdc.e', 'ousd']` offers OUSD → USDC.e as well.
 */
export function convertTargetsFor(chainId: number, assetIn: SupportedAsset): SupportedAsset[] {
  const targets: SupportedAsset[] = [];

  for (const [left, right] of convertPairsFor(chainId)) {
    const other = left === assetIn ? right : right === assetIn ? left : null;
    if (other && !targets.includes(other)) targets.push(other);
  }

  return targets;
}

/** Every asset that appears on either side of one of this chain's pairs. */
export function convertSourcesFor(chainId: number): SupportedAsset[] {
  const sources: SupportedAsset[] = [];

  for (const [left, right] of convertPairsFor(chainId)) {
    if (!sources.includes(left)) sources.push(left);
    if (!sources.includes(right)) sources.push(right);
  }

  return sources;
}
