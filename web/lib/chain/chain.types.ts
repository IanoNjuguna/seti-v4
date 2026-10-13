/**
 * Tempo network shapes, mirroring `mobile/src/lib/chain.ts`.
 *
 * Types only — the values and the env lookups live in `chain.constants.ts`, per
 * the modular structure the app uses.
 */

/** v1 supports exactly these two; see `references/tempo-chain-and-wallets.md`. */
export type SupportedAsset = 'ousd' | 'pathusd';

export interface NetworkConfig {
  chainId: number;
  displayName: string;
  rpcUrl: string;
  explorerUrl: string;
  isMainnet: boolean;
  tokens: Record<SupportedAsset, `0x${string}`>;
}
