/**
 * Tempo network shapes, mirroring `mobile/src/lib/chain.ts`.
 *
 * Types only — the values and the env lookups live in `chain.constants.ts`, the
 * asset table in `chain.assets.ts`, per the modular structure the app uses.
 */

import type { SupportedAsset } from './chain.assets';

export type { SupportedAsset };

export interface NetworkConfig {
  chainId: number;
  displayName: string;
  rpcUrl: string;
  explorerUrl: string;
  isMainnet: boolean;
  /**
   * The assets this CHAIN lists, in display order.
   *
   * Not `SUPPORTED_ASSETS`: the product supports four assets while a chain may
   * list fewer (USDT0 is mainnet-only), and a control that offered a token this
   * chain does not carry would be offering a transfer that cannot be signed.
   */
  assets: readonly SupportedAsset[];
  /**
   * Token contract per asset ON THIS CHAIN. `undefined` means the chain does not
   * list the asset — never a placeholder address.
   */
  tokens: Readonly<Record<SupportedAsset, `0x${string}` | undefined>>;
}
