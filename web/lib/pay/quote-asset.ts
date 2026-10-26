import type { SupportedAsset } from '@/lib/chain';

/**
 * #223's refusal, named once: the amount is real, one payment still spends one
 * asset, and no single balance covers it. Raised by the preview BEFORE any
 * signature, and rendered from `refusalMessageFor(COVERAGE_REFUSAL)` rather than
 * written again beside the screen that shows it.
 */
export const COVERAGE_REFUSAL = 'no-single-asset-covers';

/** What a quote request carries about the token, and nothing else. */
export interface QuoteAssetPin {
  /** Present only when the customer pinned one; absent leaves the choice to the server. */
  asset?: SupportedAsset;
}

/**
 * The pin a quote request carries (#228).
 *
 * Omitted — not `undefined`, not the primary asset — when the customer has not
 * chosen, because "no asset" is what lets the server spend from the balance the
 * money actually arrived in (#223). A pinned asset is honoured only when it covers
 * and refused with `no-single-asset-covers` when it does not, which is why nothing
 * here checks a balance: the server owns that decision and fails closed before a
 * signature.
 *
 * The other way round is the bug this replaces: naming an asset the customer has not
 * chosen prices a transfer they may have no way to pay from.
 */
export function pinAsset(pinned: SupportedAsset | null | undefined): QuoteAssetPin {
  return pinned ? { asset: pinned } : {};
}
