/**
 * The ONE asset table for the browser: which Tempo stablecoins Seti supports, on
 * which chain, and at which address.
 *
 * A mirror of `backend/src/config/assets.ts`. The two packages cannot share
 * source (`web/` ships only next/react/react-dom), so this is a deliberate copy
 * with the same shape and the same rule: the addresses are Tempo's, taken from
 * the registry for each chain —
 *
 *   https://tokenlist.tempo.xyz/list/4217   (mainnet)
 *   https://tokenlist.tempo.xyz/list/42431  (practice — Moderato)
 *
 * An address belongs to a CHAIN. OUSD and pathUSD sit at the same address on
 * both; bridged USDC does not, and copying the mainnet address into the practice
 * slot would sign a transfer against an address that holds nothing.
 *
 * A chain may also not list every asset: USDT0 is on the mainnet registry and
 * absent from the practice one, so it is absent from the practice entry here.
 * Supported is not the same as listed.
 *
 * All Tempo TIP-20 tokens use 6 decimals. EURC.e is listed on both chains and is
 * deliberately NOT supported: it is EUR-denominated while every figure the
 * product shows is KES — a currency decision, not an availability one.
 */

export const TEMPO_MAINNET_CHAIN_ID = 4217;
export const TEMPO_TESTNET_CHAIN_ID = 42431;

/** Every asset Seti supports. */
export const SUPPORTED_ASSETS = ['ousd', 'pathusd', 'usdt0', 'usdc.e'] as const;

export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

/** TIP-20 tokens on Tempo use 6 decimals. One value for every asset, on purpose. */
export const ASSET_DECIMALS = 6;

export interface TempoAsset {
  /** The ledger/route label — what a transaction row stores. */
  asset: SupportedAsset;
  /** The symbol as the registry writes it, for the mechanical receipt. */
  symbol: string;
  /** Always {@link ASSET_DECIMALS}; carried per entry so a mismatch is visible. */
  decimals: number;
  /** Display order, lowest first. Also the order a spend is resolved in. */
  order: number;
  /** The token contract on each chain that LISTS it. Absent means not listed. */
  addresses: Readonly<Partial<Record<number, `0x${string}`>>>;
}

/** The table, in display order. OUSD first: it is Seti's primary money path. */
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
      // The two chains list DIFFERENT addresses for bridged USDC.
      [TEMPO_MAINNET_CHAIN_ID]: '0x20c000000000000000000000b9537d11c60e8b50',
      [TEMPO_TESTNET_CHAIN_ID]: '0x20c0000000000000000000009e8d7eb59b783726',
    },
  },
] as const;

/** The assets a chain LISTS, in display order. */
export function assetsForChain(chainId: number): readonly SupportedAsset[] {
  return TEMPO_ASSETS.filter((entry) => entry.addresses[chainId] !== undefined)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.asset);
}

/** The registry address for an asset on a chain, or undefined when not listed. */
export function registryAddressFor(
  asset: SupportedAsset,
  chainId: number
): `0x${string}` | undefined {
  return TEMPO_ASSETS.find((entry) => entry.asset === asset)?.addresses[chainId];
}

/** Decimals per asset, from this table. */
export const ASSET_DECIMALS_BY_ASSET: Record<SupportedAsset, number> = Object.fromEntries(
  TEMPO_ASSETS.map((entry) => [entry.asset, entry.decimals])
) as Record<SupportedAsset, number>;
