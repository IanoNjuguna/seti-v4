/**
 * The mark file for each asset label, as the app serves it from `/tokens/`.
 *
 * The files are Tempo's own token icons, vendored from the token list this app already trusts
 * for addresses (`https://tokenlist.tempo.xyz/list/4217`): `design-kit/Tempo/tokens/` is the
 * source of truth and `web/public/tokens/` is the copy the app serves, per the repo's rule
 * about where an asset is authored.
 *
 * Keyed by the ledger's label (`usdc.e`, not `USDC.e`) because that is what a balance row, a
 * quote and this map all carry. A label with no entry draws nothing rather than a broken
 * image: an asset can exist on chain before anyone has vendored its mark.
 */
export const TOKEN_MARK_FILES: Record<string, string> = {
  ousd: 'ousd.svg',
  pathusd: 'pathusd.svg',
  'usdc.e': 'usdc-e.svg',
  usdt0: 'usdt0.svg',
};
