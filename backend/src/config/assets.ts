/**
 * The ONE asset table: which Tempo stablecoins Seti supports, on which chain,
 * and at which address.
 *
 * Addresses are NOT invented here. They are taken from Tempo's own registry for
 * each chain, which is the only authority on what a chain lists:
 *
 *   https://tokenlist.tempo.xyz/list/4217   (mainnet)
 *   https://tokenlist.tempo.xyz/list/42431  (practice — Moderato)
 *
 * Every entry below was read from those lists. Two facts about them drive the
 * shape of this file:
 *
 * 1. **An address belongs to a CHAIN.** OUSD and pathUSD happen to sit at the
 *    same address on both chains; USDC.e does not. Copying a mainnet address
 *    into the practice slot would sign against an address that holds nothing.
 * 2. **A chain does not necessarily list every asset.** USDT0 is on mainnet's
 *    registry and is ABSENT from the practice registry, so it is absent from the
 *    practice entry here rather than pointed at a guessed address. Availability
 *    is a property of the chain, not of the product.
 *
 * All Tempo TIP-20 tokens use 6 decimals (the registry reports 6 for all 36
 * mainnet tokens and all 8 practice tokens), which is why decimals live in the
 * asset's own entry and are asserted, not assumed, by `ASSET_DECIMALS`.
 *
 * Why these four and not EURC.e: USDT0 and USDC.e are what bridges deliver on
 * arrival into Tempo, so supporting them means a bridged deposit simply works.
 * EURC.e is listed on both chains but is a EUR-denominated token — a currency
 * decision, not an availability one. Every figure the product shows is KES, so
 * a EUR balance could not be summed into the customer's balance.
 */

/** Every asset Seti supports. The label domain of a ledger row and of a route. */
export const SUPPORTED_ASSETS = ['ousd', 'pathusd', 'usdt0', 'usdc.e'] as const;

export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

/** TIP-20 tokens on Tempo use 6 decimals. One value for every asset, on purpose. */
export const ASSET_DECIMALS = 6;

export interface TempoAsset {
  /** The ledger/route label — what `Transaction.asset` and `Wallet.asset` store. */
  asset: SupportedAsset;
  /** The symbol as the registry writes it, for logs and the mechanical receipt. */
  symbol: string;
  /** Always {@link ASSET_DECIMALS}; carried per entry so a mismatch is visible. */
  decimals: number;
  /** Display order, lowest first. Also the order a spend is resolved in. */
  order: number;
  /**
   * The token contract on each chain that LISTS it. A chain absent from this map
   * does not list the token, which is different from not supporting it.
   */
  addresses: Readonly<Partial<Record<number, `0x${string}`>>>;
}

export const TEMPO_MAINNET_CHAIN_ID = 4217;
export const TEMPO_TESTNET_CHAIN_ID = 42431;

/**
 * The table, in display order. OUSD is first because it is Seti's primary money
 * path; the rest follow in the order a customer is most likely to hold them.
 */
export const TEMPO_ASSETS: readonly TempoAsset[] = [
  {
    asset: 'ousd',
    symbol: 'OUSD',
    decimals: ASSET_DECIMALS,
    order: 0,
    addresses: {
      [TEMPO_MAINNET_CHAIN_ID]: '0x20c0000000000000000000006a37da5c996874be',
      [TEMPO_TESTNET_CHAIN_ID]: '0x20c0000000000000000000006a37da5c996874be',
    },
  },
  {
    asset: 'pathusd',
    symbol: 'pathUSD',
    decimals: ASSET_DECIMALS,
    order: 1,
    addresses: {
      [TEMPO_MAINNET_CHAIN_ID]: '0x20c0000000000000000000000000000000000000',
      [TEMPO_TESTNET_CHAIN_ID]: '0x20c0000000000000000000000000000000000000',
    },
  },
  {
    asset: 'usdt0',
    symbol: 'USDT0',
    decimals: ASSET_DECIMALS,
    order: 2,
    addresses: {
      // Mainnet only: the practice registry lists 8 tokens and USDT0 is not one
      // of them. Absent, never guessed.
      [TEMPO_MAINNET_CHAIN_ID]: '0x20c00000000000000000000014f22ca97301eb73',
    },
  },
  {
    asset: 'usdc.e',
    symbol: 'USDC.e',
    decimals: ASSET_DECIMALS,
    order: 3,
    addresses: {
      // The two chains list DIFFERENT addresses for bridged USDC. This is the
      // pair that proves an address cannot be shared across networks.
      [TEMPO_MAINNET_CHAIN_ID]: '0x20c000000000000000000000b9537d11c60e8b50',
      [TEMPO_TESTNET_CHAIN_ID]: '0x20c0000000000000000000009e8d7eb59b783726',
    },
  },
] as const;

/**
 * Compile-time proof that the address table covers every supported label.
 *
 * If an asset is added to `SUPPORTED_ASSETS` and not to `TEMPO_ASSETS` (or the
 * reverse), one of these two lines stops compiling. A label with no address is a
 * token that can never be read or spent, and a silent omission looks exactly like
 * a customer whose balance is zero — which is the bug this whole table exists to
 * end.
 */
type CoveredLabel = (typeof TEMPO_ASSETS)[number]['asset'];
const _tableCoversEveryLabel: Exclude<SupportedAsset, CoveredLabel> extends never ? true : never =
  true;
const _tableHasNoStrayLabel: Exclude<CoveredLabel, SupportedAsset> extends never ? true : never =
  true;
void _tableCoversEveryLabel;
void _tableHasNoStrayLabel;

/** The assets a chain LISTS, in display order — what a balance sums over. */
export function assetsForChain(chainId: number): readonly SupportedAsset[] {
  return TEMPO_ASSETS.filter((entry) => entry.addresses[chainId] !== undefined)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.asset);
}

/** The token contract for an asset on a chain, or undefined when not listed. */
export function tokenAddressFor(
  asset: SupportedAsset,
  chainId: number
): `0x${string}` | undefined {
  return TEMPO_ASSETS.find((entry) => entry.asset === asset)?.addresses[chainId];
}

/** The registry symbol for an asset label (`usdc.e` → `USDC.e`). */
export function symbolFor(asset: SupportedAsset): string {
  return TEMPO_ASSETS.find((entry) => entry.asset === asset)?.symbol ?? asset.toUpperCase();
}
