import { isAddress, type Chain } from 'viem';
import type { Network } from '@/lib/network';
import type { NetworkConfig, SupportedAsset } from './chain.types';
import {
  ASSET_DECIMALS_BY_ASSET,
  SUPPORTED_ASSETS,
  TEMPO_MAINNET_CHAIN_ID,
  TEMPO_TESTNET_CHAIN_ID,
  assetsForChain,
  registryAddressFor,
} from './chain.assets';

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
export { TEMPO_MAINNET_CHAIN_ID, TEMPO_TESTNET_CHAIN_ID, SUPPORTED_ASSETS } from './chain.assets';

/**
 * The chain's own name, in the one place the word is written.
 *
 * Both Tempo networks are Tempo: `lib/network` names which WORLD of data an
 * account is in (Practice | Live), and this names the chain that carries it. A
 * surface that has to print the chain reads it here rather than writing the word
 * a second time.
 */
export const CHAIN_NAME = 'Tempo';

/**
 * Decimals per asset — all TIP-20 tokens on Tempo are 6, and the table is the one
 * place that says so.
 */
export const ASSET_DECIMALS: Record<SupportedAsset, number> = ASSET_DECIMALS_BY_ASSET;

/**
 * Env lookups, one per asset, written out.
 *
 * `usdc.e` would derive `USDC.E` / `USDC` from the label and neither is a
 * variable anyone would set, so every name is spelled here rather than assembled.
 */
const ENV = {
  chainId: process.env.NEXT_PUBLIC_TEMPO_CHAIN_ID,
  asset: process.env.NEXT_PUBLIC_TEMPO_ASSET,
  allowMainnet: process.env.NEXT_PUBLIC_ALLOW_MAINNET,
  testnet: {
    ousd: process.env.NEXT_PUBLIC_TEMPO_TESTNET_TOKEN_OUSD,
    pathusd: process.env.NEXT_PUBLIC_TEMPO_TESTNET_TOKEN_PATHUSD,
    usdt0: process.env.NEXT_PUBLIC_TEMPO_TESTNET_TOKEN_USDT0,
    'usdc.e': process.env.NEXT_PUBLIC_TEMPO_TESTNET_TOKEN_USDCE,
  } satisfies Record<SupportedAsset, string | undefined>,
  mainnet: {
    ousd: process.env.NEXT_PUBLIC_TEMPO_MAINNET_TOKEN_OUSD,
    pathusd: process.env.NEXT_PUBLIC_TEMPO_MAINNET_TOKEN_PATHUSD,
    usdt0: process.env.NEXT_PUBLIC_TEMPO_MAINNET_TOKEN_USDT0,
    'usdc.e': process.env.NEXT_PUBLIC_TEMPO_MAINNET_TOKEN_USDCE,
  } satisfies Record<SupportedAsset, string | undefined>,
  shared: {
    ousd: process.env.NEXT_PUBLIC_TEMPO_TOKEN_OUSD,
    pathusd: process.env.NEXT_PUBLIC_TEMPO_TOKEN_PATHUSD,
    usdt0: process.env.NEXT_PUBLIC_TEMPO_TOKEN_USDT0,
    'usdc.e': process.env.NEXT_PUBLIC_TEMPO_TOKEN_USDCE,
  } satisfies Record<SupportedAsset, string | undefined>,
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

/** `assets` and `tokens` are per network and are attached by `chainConfigFor`. */
const NETWORKS: Record<number, Omit<NetworkConfig, 'tokens' | 'assets'>> = {
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

  return {
    ...selected,
    assets: assetsForChain(chainId),
    tokens: buildTokens(selected.isMainnet ? 'mainnet' : 'testnet', chainId),
  };
}

/**
 * The token contract per asset, for ONE chain.
 *
 * Precedence: a per-network override (`NEXT_PUBLIC_TEMPO_MAINNET_TOKEN_OUSD`) →
 * the shared value (`NEXT_PUBLIC_TEMPO_TOKEN_OUSD`) → the registry address for
 * THIS chain. The registry default is what lets a new asset work without an env
 * edit, which matters: the deployment serving this bug has an env file nobody is
 * going to hand-edit, and a customer whose USDT0 arrived by bridge cannot wait
 * for one.
 *
 * An override, when present, is still validated — a truncated or mistyped
 * address is a non-empty string that would be signed as the token contract.
 * An asset the chain does not list stays `undefined`.
 */
function buildTokens(
  target: Network,
  chainId: number
): Record<SupportedAsset, `0x${string}` | undefined> {
  const scoped = target === 'mainnet' ? ENV.mainnet : ENV.testnet;
  const tokens = {} as Record<SupportedAsset, `0x${string}` | undefined>;

  for (const asset of SUPPORTED_ASSETS) {
    const registry = registryAddressFor(asset, chainId);
    if (registry === undefined) {
      tokens[asset] = undefined;
      continue;
    }

    const override = scoped[asset] || ENV.shared[asset] || undefined;
    tokens[asset] = override ? requireToken(asset, override) : registry;
  }

  return tokens;
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

/** The assets a NETWORK lists, in display order — what a balance sums over. */
export function assetsFor(target: Network): readonly SupportedAsset[] {
  return chainConfigFor(target).assets;
}

/**
 * The TIP-20 contract for an asset ON A NETWORK — the address that gets signed.
 *
 * Fails closed for an asset the chain does not list. USDT0 has no practice
 * contract, and returning a placeholder (or the mainnet address) there would sign
 * against an account that holds nothing.
 */
export function getTokenContractFor(asset: SupportedAsset, target: Network): `0x${string}` {
  const contract = chainConfigFor(target).tokens[asset];
  if (!contract) {
    throw new Error(
      `This network does not list ${asset}, so there is no token contract to sign against.`
    );
  }
  return contract;
}

/** The explorer link for a transaction, on the network it happened on. */
export function getExplorerTxUrlFor(txHash: string, target: Network): string {
  return `${chainConfigFor(target).explorerUrl}/tx/${txHash}`;
}

/**
 * An env OVERRIDE, validated.
 *
 * Presence is not enough. A truncated or mistyped address (e.g. an abbreviated
 * `0x20c0...74be`) is a non-empty string that would be signed as the token
 * contract, sending the transfer to an address that holds nothing. Same class of
 * bug as a mis-checksummed payout address, so it fails the same way.
 */
function requireToken(asset: SupportedAsset, value: string): `0x${string}` {
  if (!isAddress(value)) {
    throw new Error(
      `The configured address for ${asset} is not a valid 20-byte address: ${value}. ` +
        'Fix or remove the override so the registry address is used.'
    );
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

/** The TIP-20 contract to call for an asset, on the network this build serves. */
export function getTokenContract(asset: SupportedAsset): `0x${string}` {
  return getTokenContractFor(asset, DEPLOYMENT_NETWORK);
}

export function getExplorerTxUrl(txHash: string): string {
  return `${network.explorerUrl}/tx/${txHash}`;
}
