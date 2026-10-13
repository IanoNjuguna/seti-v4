import { env } from './env';

/**
 * Supported Tempo networks and their canonical configuration.
 *
 * Values sourced from the official Tempo Go SDK, docs, and chainid.network:
 * - Mainnet chain ID: 4217
 * - Testnet (Moderato) chain ID: 42431
 */
export const TEMPO_MAINNET_CHAIN_ID = 4217;
export const TEMPO_TESTNET_CHAIN_ID = 42431;

export type NetworkName = 'tempo-mainnet' | 'tempo-testnet';

/**
 * Assets supported in v1.
 *
 * Deliberately limited to the two stablecoins verified as deployed on BOTH
 * Tempo networks (checked via eth_getCode against rpc.tempo.xyz and
 * rpc.moderato.tempo.xyz, decimals 6 on both):
 *
 *   pathUSD  0x20c0000000000000000000000000000000000000
 *   OUSD     0x20c0000000000000000000006a37da5c996874be
 *
 * USDC.e, USDT0 and EURC.e were removed: none of them has deployed bytecode at
 * the addresses previously configured, on either chain. Carrying them meant a
 * transfer to a no-code address (which can succeed as a silent no-op rather
 * than reverting) and an indexer querying dead contracts on every tick. Do not
 * re-add an asset without confirming eth_getCode is non-empty on BOTH chains.
 */
export const SUPPORTED_ASSETS = ['pathusd', 'ousd'] as const;

export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

export interface NetworkConfig {
  name: NetworkName;
  chainId: number;
  displayName: string;
  rpcUrl: string;
  wsUrl?: string;
  explorerUrl: string;
  isMainnet: boolean;
  bridgeEnv: 'live' | 'sandbox';
  tokens: Record<SupportedAsset, `0x${string}`>;
}

function getDefaultRpcUrl(chainId: number): string {
  if (env.ALCHEMY_API_KEY) {
    // Alchemy Tempo endpoints. Verify these against your Alchemy dashboard.
    if (chainId === TEMPO_MAINNET_CHAIN_ID) {
      return `https://tempo-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
    }
    if (chainId === TEMPO_TESTNET_CHAIN_ID) {
      return `https://tempo-moderato.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
    }
  }

  const defaults: Record<number, string> = {
    [TEMPO_MAINNET_CHAIN_ID]: 'https://rpc.tempo.xyz',
    [TEMPO_TESTNET_CHAIN_ID]: 'https://rpc.moderato.tempo.xyz',
  };

  return defaults[chainId];
}

function buildTokenMap(): Record<SupportedAsset, `0x${string}`> {
  const envMap: Record<SupportedAsset, string> = {
    pathusd: env.TEMPO_TOKEN_PATHUSD,
    ousd: env.TEMPO_TOKEN_OUSD,
  };

  const tokens = {} as Record<SupportedAsset, `0x${string}`>;
  for (const asset of SUPPORTED_ASSETS) {
    const value = envMap[asset];
    if (!value) {
      throw new Error(`Missing env var for ${asset}`);
    }
    tokens[asset] = value as `0x${string}`;
  }
  return tokens;
}

const tokenMap = buildTokenMap();

const networks: Record<NetworkName, NetworkConfig> = {
  'tempo-mainnet': {
    name: 'tempo-mainnet',
    chainId: TEMPO_MAINNET_CHAIN_ID,
    displayName: 'Tempo Mainnet',
    rpcUrl: getDefaultRpcUrl(TEMPO_MAINNET_CHAIN_ID),
    wsUrl: 'wss://rpc.mainnet.tempo.xyz',
    explorerUrl: 'https://explore.tempo.xyz',
    isMainnet: true,
    bridgeEnv: 'live',
    tokens: tokenMap,
  },
  'tempo-testnet': {
    name: 'tempo-testnet',
    chainId: TEMPO_TESTNET_CHAIN_ID,
    displayName: 'Tempo Testnet (Moderato)',
    rpcUrl: getDefaultRpcUrl(TEMPO_TESTNET_CHAIN_ID),
    wsUrl: 'wss://rpc.moderato.tempo.xyz',
    explorerUrl: 'https://explore.testnet.tempo.xyz',
    isMainnet: false,
    bridgeEnv: 'sandbox',
    tokens: tokenMap,
  },
};

function resolveNetwork(): NetworkConfig {
  const chainId = env.TEMPO_CHAIN_ID;
  const allowMainnet = env.ALLOW_MAINNET === 'true';

  // If no chain ID is set, default to testnet in development and block in
  // production until explicitly configured.
  if (!chainId) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'TEMPO_CHAIN_ID is required in production. Set it to the target Tempo network chain ID.'
      );
    }
    return networks['tempo-testnet'];
  }

  const numericChainId = Number(chainId);
  const selected = Object.values(networks).find((n) => n.chainId === numericChainId);

  if (!selected) {
    throw new Error(
      `Unsupported Tempo chain ID: ${chainId}. Supported: ${TEMPO_MAINNET_CHAIN_ID} (mainnet), ${TEMPO_TESTNET_CHAIN_ID} (testnet).`
    );
  }

  if (selected.isMainnet && !allowMainnet) {
    throw new Error(
      `Mainnet chain ID ${TEMPO_MAINNET_CHAIN_ID} detected but ALLOW_MAINNET is not set to "true". ` +
        'Set ALLOW_MAINNET=true explicitly after confirming you intend to operate on mainnet.'
    );
  }

  // Allow env-provided RPC to override defaults (useful for private endpoints),
  // but keep the rest of the canonical config.
  if (env.TEMPO_RPC_URL) {
    return { ...selected, rpcUrl: env.TEMPO_RPC_URL };
  }

  return selected;
}

export const network = resolveNetwork();

export function getExplorerTxUrl(txHash: string): string {
  return `${network.explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${network.explorerUrl}/address/${address}`;
}
