import { isAddress, type Chain } from 'viem';
import type { Network } from '@/lib/network';
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

/**
 * The chain's own name, in the one place the word is written.
 *
 * Both Tempo networks are Tempo: `lib/network` names which WORLD of data an
 * account is in (Practice | Live), and this names the chain that carries it. A
 * surface that has to print the chain reads it here rather than writing the word
 * a second time.
 */
export const CHAIN_NAME = 'Tempo';

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

/** The chain id behind each of the client's two network words. */
export const CHAIN_ID_FOR: Record<Network, number> = {
  testnet: TEMPO_TESTNET_CHAIN_ID,
  mainnet: TEMPO_MAINNET_CHAIN_ID,
};

/**
 * A network's chain config, resolved AT RUNTIME — the fix for a chain id that
 * used to be frozen into the build.
 *
 * `NEXT_PUBLIC_TEMPO_CHAIN_ID` answers one question: which chain does THIS
 * DEPLOYMENT serve. It cannot answer which chain a CUSTOMER is on, because the
 * account's network is per-account (the Practice ⇄ Live switch writes it, the
 * server decides it) and arrives well after the bundle is built. Reading the
 * build constant on the signing path meant an account practising on Moderato
 * signed a mainnet transfer from an address holding nothing there — the chain
 * refused it with `TIP20 token error: InsufficientBalance { available: 0 }`.
 *
 * So the addresses a payment signs are now derived from the network the ACCOUNT
 * is acting on, and the build constant only sets the DEFAULT (and the deployment's
 * consent — see below).
 *
 * Mainnet still requires `NEXT_PUBLIC_ALLOW_MAINNET=true`: that flag is the
 * deployment saying live money may be moved at all, and it is checked here per
 * request rather than once at import. A practice build therefore cannot be steered
 * onto mainnet by anything the client sends, and the guard fails closed.
 */
export function chainConfigFor(target: Network): NetworkConfig {
  const chainId = CHAIN_ID_FOR[target];
  const selected = NETWORKS[chainId];

  if (!selected) {
    throw new Error(
      `No chain configuration for "${target}" (chain id ${chainId}). Known: ` +
        `${TEMPO_TESTNET_CHAIN_ID} (testnet) and ${TEMPO_MAINNET_CHAIN_ID} (mainnet).`
    );
  }

  if (selected.isMainnet && ENV.allowMainnet !== 'true') {
    throw new Error(
      `This build is asked for a mainnet chain (${TEMPO_MAINNET_CHAIN_ID}) but ` +
        'NEXT_PUBLIC_ALLOW_MAINNET is not "true". Set it explicitly before operating on mainnet.'
    );
  }

  return { ...selected, tokens: { ousd: requireToken('ousd'), pathusd: requireToken('pathusd') } };
}

/** The viem chain for a network, for anything that needs one (wallets, links). */
export function tempoChainFor(target: Network): Chain {
  const config = chainConfigFor(target);

  return {
    id: config.chainId,
    name: config.displayName,
    nativeCurrency: { name: CHAIN_NAME, symbol: 'TEMPO', decimals: 18 },
    rpcUrls: {
      default: { http: [config.rpcUrl] },
      public: { http: [config.rpcUrl] },
    },
    blockExplorers: { default: { name: 'Tempo Explorer', url: config.explorerUrl } },
  } satisfies Chain;
}

/** The TIP-20 contract for an asset ON A NETWORK — the address that gets signed. */
export function getTokenContractFor(asset: SupportedAsset, target: Network): `0x${string}` {
  return chainConfigFor(target).tokens[asset];
}

/** The explorer link for a transaction, on the network it happened on. */
export function getExplorerTxUrlFor(txHash: string, target: Network): string {
  return `${chainConfigFor(target).explorerUrl}/tx/${txHash}`;
}

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

/**
 * The DEPLOYMENT's network, from its own build config.
 *
 * One question only: which chain does this build serve by default. The answer is
 * available before any account read, which is what lets a control render the right
 * initial state — and it is the fallback for the signing path while the account's
 * network is still unknown. It is NOT the account's network: see `chainConfigFor`.
 */
function resolveNetwork(): NetworkConfig {
  const chainId = Number(ENV.chainId);
  const word: Network | null =
    chainId === TEMPO_MAINNET_CHAIN_ID
      ? 'mainnet'
      : chainId === TEMPO_TESTNET_CHAIN_ID
        ? 'testnet'
        : null;

  if (!word) {
    throw new Error(
      `NEXT_PUBLIC_TEMPO_CHAIN_ID is ${ENV.chainId ?? 'unset'}. Use ${TEMPO_TESTNET_CHAIN_ID} ` +
        `(testnet) or ${TEMPO_MAINNET_CHAIN_ID} (mainnet).`
    );
  }

  return chainConfigFor(word);
}

export const network = resolveNetwork();

/**
 * Whether THIS BUILD serves mainnet.
 *
 * The browser learns the served network the same way the backend does: from the
 * configured chain (`NEXT_PUBLIC_TEMPO_CHAIN_ID`, gated by
 * `NEXT_PUBLIC_ALLOW_MAINNET`). Because it is the DEPLOYMENT's own answer — and
 * is therefore known before any account read — a control can disable Live for
 * the real reason from the first render instead of guessing, and can never offer
 * Live on a build that does not serve it. It must agree with the backend's
 * served network (`TEMPO_CHAIN_ID` / `DEFAULT_NETWORK` / `ALLOW_MAINNET`).
 */
export const DEPLOYMENT_SERVES_MAINNET: boolean = network.isMainnet;

/**
 * The network this BUILD serves — `testnet` is Practice, `mainnet` is Live.
 *
 * The deployment's own answer, available before any account read, for a control
 * that has to render the right initial state (and the right reason) before the
 * server has spoken.
 */
export const DEPLOYMENT_NETWORK: 'testnet' | 'mainnet' = DEPLOYMENT_SERVES_MAINNET
  ? 'mainnet'
  : 'testnet';

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
