import Constants from 'expo-constants';
import type { Chain } from 'viem';

/**
 * Canonical Tempo network configuration.
 *
 * Keep this in sync with backend/src/config/networks.ts.
 * Defaults to testnet (Moderato) unless ALLOW_MAINNET is explicitly enabled.
 */
export const TEMPO_MAINNET_CHAIN_ID = 4217;
export const TEMPO_TESTNET_CHAIN_ID = 42431;

export type NetworkName = 'tempo-mainnet' | 'tempo-testnet';

/**
 * Assets supported in v1. Must stay in sync with
 * backend/src/config/networks.ts.
 *
 * Limited to the two stablecoins verified as deployed on BOTH Tempo networks.
 * USDC.e, USDT0 and EURC.e were removed because none has deployed bytecode at
 * the previously configured addresses on either chain.
 */
export const SUPPORTED_ASSETS = ['pathusd', 'ousd'] as const;

export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

export interface NetworkConfig {
  name: NetworkName;
  chainId: number;
  displayName: string;
  rpcUrl: string;
  explorerUrl: string;
  isMainnet: boolean;
  tokens: Record<SupportedAsset, `0x${string}`>;
}

const networks: Record<NetworkName, Omit<NetworkConfig, 'tokens'>> = {
  'tempo-mainnet': {
    name: 'tempo-mainnet',
    chainId: TEMPO_MAINNET_CHAIN_ID,
    displayName: 'Tempo Mainnet',
    rpcUrl: 'https://rpc.tempo.xyz',
    explorerUrl: 'https://explore.tempo.xyz',
    isMainnet: true,
  },
  'tempo-testnet': {
    name: 'tempo-testnet',
    chainId: TEMPO_TESTNET_CHAIN_ID,
    displayName: 'Tempo Testnet (Moderato)',
    rpcUrl: 'https://rpc.moderato.tempo.xyz',
    explorerUrl: 'https://explore.testnet.tempo.xyz',
    isMainnet: false,
  },
};

type TokenKey = 'pathusd' | 'ousd';

interface ExpoExtra {
  privyAppId?: string;
  tempoChainId?: string;
  allowMainnet?: string;
  alchemyApiKey?: string;
  tempoRpcUrl?: string;
  /** Address the merchant fee leg is sent to. Must match the backend's value. */
  treasuryAddress?: string;
  tempoTokens?: Record<TokenKey, string | undefined>;
}

const TOKEN_ENV_NAMES: Record<TokenKey, string> = {
  pathusd: 'TEMPO_TOKEN_PATHUSD',
  ousd: 'TEMPO_TOKEN_OUSD',
};

function requireExtra(): ExpoExtra {
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  if (!extra) {
    throw new Error(
      'Expo extra config is missing. Create mobile/.env from mobile/.env.example.'
    );
  }
  return extra;
}

function getTokenAddress(extra: ExpoExtra, name: TokenKey): `0x${string}` {
  const value = extra.tempoTokens?.[name];
  if (!value) {
    throw new Error(
      `${TOKEN_ENV_NAMES[name]} is not set in mobile/.env.`
    );
  }
  return value as `0x${string}`;
}

function getDefaultRpcUrl(chainId: number, alchemyApiKey?: string): string {
  if (alchemyApiKey) {
    // Alchemy Tempo endpoints. Verify these against your Alchemy dashboard.
    if (chainId === TEMPO_MAINNET_CHAIN_ID) {
      return `https://tempo-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
    }
    if (chainId === TEMPO_TESTNET_CHAIN_ID) {
      return `https://tempo-testnet.g.alchemy.com/v2/${alchemyApiKey}`;
    }
  }

  const defaults: Record<number, string> = {
    [TEMPO_MAINNET_CHAIN_ID]: 'https://rpc.tempo.xyz',
    [TEMPO_TESTNET_CHAIN_ID]: 'https://rpc.moderato.tempo.xyz',
  };

  return defaults[chainId];
}

function resolveNetwork(): NetworkConfig {
  const extra = requireExtra();
  const chainId = extra.tempoChainId;
  const allowMainnet = extra.allowMainnet === 'true';

  if (!chainId) {
    throw new Error(
      'TEMPO_CHAIN_ID is not set in mobile/.env. Use 42431 for testnet or 4217 for mainnet.'
    );
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
        'Set ALLOW_MAINNET=true in mobile/.env before operating on mainnet.'
    );
  }

  const tokens: Record<SupportedAsset, `0x${string}`> = {
    pathusd: getTokenAddress(extra, 'pathusd'),
    ousd: getTokenAddress(extra, 'ousd'),
  };

  const rpcUrl = extra.tempoRpcUrl || getDefaultRpcUrl(numericChainId, extra.alchemyApiKey);

  return { ...selected, rpcUrl, tokens };
}

export const network = resolveNetwork();

export const tempoChain = {
  id: network.chainId,
  name: network.displayName,
  nativeCurrency: {
    name: 'Tempo',
    symbol: 'TEMPO',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [network.rpcUrl] },
    public: { http: [network.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Tempo Explorer', url: network.explorerUrl },
  },
} as const satisfies Chain;

export const assetDecimals: Record<SupportedAsset, number> = Object.fromEntries(
  SUPPORTED_ASSETS.map((asset) => [asset, 6])
) as Record<SupportedAsset, number>;

export function getTokenContract(asset: SupportedAsset): `0x${string}` {
  if (SUPPORTED_ASSETS.includes(asset)) {
    return network.tokens[asset];
  }
  throw new Error(`Unsupported asset: ${asset}`);
}

export function getExplorerTxUrl(txHash: string): string {
  return `${network.explorerUrl}/tx/${txHash}`;
}

/**
 * Address that collects the merchant fee.
 *
 * Exposed here so the app can show where the fee goes before the customer
 * signs. Fails closed: sending the fee leg to an unset or malformed address
 * would burn it, so a missing value must surface as an error rather than a
 * zero address.
 */
export function getTreasuryAddress(): `0x${string}` {
  const value = (Constants.expoConfig?.extra as ExpoExtra | undefined)?.treasuryAddress;

  if (!value) {
    throw new Error(
      'SETI_TREASURY_ADDRESS is not set in mobile/.env. It must match the backend value.'
    );
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`SETI_TREASURY_ADDRESS is not a valid 20-byte address: ${value}`);
  }

  return value as `0x${string}`;
}
