import { TEMPO_ASSETS } from '@/lib/chain';

/**
 * A quote names its assets by their ledger labels (`ousd`, `pathusd`); a customer reads
 * the registry's spelling (`OUSD`, `pathUSD`). One lookup, from the same table that
 * carries the token contracts, and a label it does not know is printed as it arrived
 * rather than as a guess.
 *
 * IT MOVED HERE FROM THE BALANCE CARD (#328). It used to sit in
 * `home/BalanceTokenSwap.constants.ts`, beside the classname of the swap control that a
 * balance row drew; the control is gone and the swap page is now the only surface that
 * names a pair, so the lookup lives with the surfaces that use it.
 */
export function swapAssetSymbol(asset: string): string {
  return TEMPO_ASSETS.find((entry) => entry.asset === asset)?.symbol ?? asset;
}
