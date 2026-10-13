import { isAddress, type Chain } from 'viem';
import type { NetworkConfig, SupportedAsset } from './chain.types';

/**
 * Canonical Tempo network configuration for the browser.
 *
 * Mirror of `mobile/src/lib/chain.ts`, with the two browser differences:
 * `NEXT_PUBLIC_*` instead of Expo `extra`, and no React Native platform branch.
 * Both read the same values, which must also match
 * `backend/src/config/networks.ts`.
 *
 * Defaults to testnet (Moderato) unless `NEXT_PUBLIC_ALLOW_MAINNET` is "true",
 * and an unsupported chain id is refused rather than silently used — an address
 * on the wrong chain is an unrecoverable payment error.
 */
export const TEMPO_MAINNET_CHAIN_ID = 4217;
export const TEMPO_TESTNET_CHAIN_ID = 42431;

export const SUPPORTED_ASSETS = ['pathusd', 'ousd'] as const;

/** TIP-20 tokens on Tempo use 6 decimals, like USDC. */
export const ASSET_DECIMALS: Record<SupportedAsset, number> = { ousd: 6, pathusd: 6 };

const ENV = {
  chainId: process.env.NEXT_PUBLIC_TEMPO_CHAIN_ID,
  asset: process.env.NEXT_PUBLIC_TEMPO_ASSET,
  pathusd: process.env.NEXT_PUBLIC_TEMPO_TOKEN_PATHUSD,
  ousd: process.env.NEXT_PUBLIC_TEMPO_TOKEN_OUSD,
  allowMainnet: process.env.NEXT_PUBLIC_ALLOW_MAINNET,
} as const;

/**
 * The ONE place the app's primary asset is chosen.
 *
 * OUSD is Seti's decided money path; pathUSD remains supported (both are TIP-20
 * tokens with deployed bytecode on both chains) but is no longer what the app
 * signs. `NEXT_PUBLIC_TEMPO_ASSET` picks it, defaulting to `ousd`; both signing
 * hooks (`useSendPanel`, `usePayMerchant`) and every label read this constant
 * rather than repeating a literal — a second hardcode is how the asset stays
 * wrong. It must agree with the backend's `TEMPO_ASSET`.
 *
 * Refused rather than defaulted when it names an unsupported asset: signing
 * against the wrong token contract is an unrecoverable payment error, the same
 * class as a mistyped token address below.
 */
function resolvePrimaryAsset(): SupportedAsset {
  const candidate = ENV.asset ?? 'ousd';

  if (!(SUPPORTED_ASSETS as readonly string[]).includes(candidate)) {
    throw new Error(
      `NEXT_PUBLIC_TEMPO_ASSET is "${candidate}", which is not a supported asset. ` +
        `Use one of: ${SUPPORTED_ASSETS.join(', ')}.`
    );
  }

  return candidate as SupportedAsset;
}

export const PRIMARY_ASSET: SupportedAsset = resolvePrimaryAsset();

const NETWORKS: Record<number, Omit<NetworkConfig, 'tokens'>> = {
  [TEMPO_MAINNET_CHAIN_ID]: {
    chainId: TEMPO_MAINNET_CHAIN_ID,
    displayName: 'Tempo Mainnet',
    rpcUrl: 'https://rpc.tempo.xyz',
    explorerUrl: 'https://explore.tempo.xyz',
    isMainnet: true,
  },
  [TEMPO_TESTNET_CHAIN_ID]: {
    chainId: TEMPO_TESTNET_CHAIN_ID,
    displayName: 'Tempo Testnet (Moderato)',
    rpcUrl: 'https://rpc.moderato.tempo.xyz',
    explorerUrl: 'https://explore.testnet.tempo.xyz',
    isMainnet: false,
  },
};

function requireToken(asset: SupportedAsset): `0x${string}` {
  const name = `NEXT_PUBLIC_TEMPO_TOKEN_${asset.toUpperCase()}`;
  const value = ENV[asset];

  if (!value) {
    throw new Error(
      `${name} is not set. Copy web/.env.example to web/.env.local and fill it in — it ` +
        'must match the backend and mobile values.'
    );
  }

  // Presence is not enough. A truncated or mistyped address (e.g. an abbreviated
  // `0x20c0...74be`) is a non-empty string that would be signed as the token
  // contract, sending the transfer to an address that holds nothing. Same class
  // of bug as a mis-checksummed payout address, so it fails the same way.
  if (!isAddress(value)) {
    throw new Error(`${name} is not a valid 20-byte address: ${value}`);
  }

  return value as `0x${string}`;
}

function resolveNetwork(): NetworkConfig {
  const chainId = Number(ENV.chainId);
  const selected = NETWORKS[chainId];

  if (!selected) {
    throw new Error(
      `NEXT_PUBLIC_TEMPO_CHAIN_ID is ${ENV.chainId ?? 'unset'}. Use ${TEMPO_TESTNET_CHAIN_ID} ` +
        `(testnet) or ${TEMPO_MAINNET_CHAIN_ID} (mainnet).`
    );
  }

  if (selected.isMainnet && ENV.allowMainnet !== 'true') {
    throw new Error(
      `Mainnet chain id ${TEMPO_MAINNET_CHAIN_ID} is configured but NEXT_PUBLIC_ALLOW_MAINNET ` +
        'is not "true". Set it explicitly before operating on mainnet.'
    );
  }

  return { ...selected, tokens: { ousd: requireToken('ousd'), pathusd: requireToken('pathusd') } };
}

export const network = resolveNetwork();

export const tempoChain = {
  id: network.chainId,
  name: network.displayName,
  nativeCurrency: { name: 'Tempo', symbol: 'TEMPO', decimals: 18 },
  rpcUrls: {
    default: { http: [network.rpcUrl] },
    public: { http: [network.rpcUrl] },
  },
  blockExplorers: { default: { name: 'Tempo Explorer', url: network.explorerUrl } },
} as const satisfies Chain;

/** The TIP-20 contract to call for an asset. */
export function getTokenContract(asset: SupportedAsset): `0x${string}` {
  return network.tokens[asset];
}

export function getExplorerTxUrl(txHash: string): string {
  return `${network.explorerUrl}/tx/${txHash}`;
}
