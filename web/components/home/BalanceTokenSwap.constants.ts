import { TEMPO_ASSETS } from '@/lib/chain';

/**
 * The row action's class, from the repo's own inline-link recipe.
 * `EmptyActivity` and `ProfileInviteRow` both set a small inline control this way: a
 * `min-touch` box so the tap target is a finger rather than a word, the hairline-free
 * `text-*` ink, an underline on hover, and the cobalt focus ring the system uses for
 * focus everywhere.
 *
 * The ink is `on-dark`, NOT `text-link`. This control lives inside the balance card,
 * which is the dark canvas, and `design/revolut.md` is explicit that an inline link in
 * a dark region steps up to the readable on-canvas ink rather than the cobalt accent —
 * cobalt on black is the contrast failure the doc names.
 */
export const SWAP_ACTION_CLASS =
  'inline-flex min-touch items-center self-end rounded-sm font-semibold text-on-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark';

/**
 * A quote names its assets by their ledger labels (`ousd`, `pathusd`); a customer reads
 * the registry's spelling (`OUSD`, `pathUSD`). One lookup, from the same table that
 * carries the token contracts, and a label it does not know is printed as it arrived
 * rather than as a guess.
 */
export function swapAssetSymbol(asset: string): string {
  return TEMPO_ASSETS.find((entry) => entry.asset === asset)?.symbol ?? asset;
}
