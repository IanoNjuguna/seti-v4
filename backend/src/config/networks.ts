import { env } from './env';
import {
  DEFAULT_NETWORK,
  NETWORK_LABEL,
  NETWORKS,
  type Network,
  TEMPO_MAINNET_CHAIN_ID,
  TEMPO_TESTNET_CHAIN_ID,
  networkForChainId,
} from '../lib/network.js';

import { evaluateRpcCoherence, IncoherentRpcConfigError } from './rpc-coherence.js';

/**
 * PER-NETWORK Tempo configuration.
 *
 * This used to resolve ONE network from single env values, which cannot express
 * the thing the product now needs: an account practises on testnet and goes live
 * on mainnet, so chain id, RPC, token addresses, treasury and the check anchors
 * are each a property of a NETWORK rather than of the process. Both networks are
 * built here; `servedNetwork` names the one this deployment actually serves, and
 * every default export below is that network's config so existing callers keep
 * working unchanged.
 *
 * The mainnet opt-in is unchanged and stays opt-in: `ALLOW_MAINNET` must be
 * exactly "true" for mainnet to be SERVED at all (a boot refusal otherwise), and
 * it defaults to false.
 *
 * Values sourced from the official Tempo Go SDK, docs, and chainid.network:
 * - Mainnet chain ID: 4217
 * - Testnet (Moderato) chain ID: 42431
 */
export { TEMPO_MAINNET_CHAIN_ID, TEMPO_TESTNET_CHAIN_ID };
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

/**
 * The primary asset the app spends, from the ONE setting (`TEMPO_ASSET`).
 *
 * OUSD is the decided money path; `pathusd` remains supported for older rows and
 * balances but is no longer what the app signs. Every backend default — the route
 * schemas, the balance lookup, `prove:batch` — reads this constant rather than
 * repeating a literal, so the asset is chosen in exactly one place. The web app
 * mirrors it as `PRIMARY_ASSET` in `web/lib/chain`, from `NEXT_PUBLIC_TEMPO_ASSET`.
 */
export const PRIMARY_ASSET: SupportedAsset = env.TEMPO_ASSET;

/** The three check anchors, per network. */
export type AnchorKind = 'payout' | 'send' | 'quote';

export interface NetworkConfig {
  /** The domain network — `testnet` | `mainnet`. */
  network: Network;
  /** The chain config name — `tempo-testnet` | `tempo-mainnet`. The cursor key. */
  name: NetworkName;
  chainId: number;
  displayName: string;
  /** The product's word for this network: Practice | Live. */
  label: string;
  rpcUrl: string;
  wsUrl?: string;
  explorerUrl: string;
  isMainnet: boolean;
  bridgeEnv: 'live' | 'sandbox';
  tokens: Record<SupportedAsset, `0x${string}`>;
  /**
   * Address that collects the platform fee ON THIS NETWORK.
   *
   * v1 collects the fee as its own transfer inside the customer's transaction
   * (`batch` mode), so the fee leg pays this address. Per-network because the
   * mainnet treasury and the testnet treasury are different places to send real
   * versus practice money.
   */
  treasuryAddress: string;
  /**
   * Known receipts the check suites reconcile against, per network.
   *
   * A receipt is per CHAIN: an anchor taken on Moderato proves nothing about
   * mainnet. Pinned here so a suite reading the served network reads a receipt
   * from that same network.
   */
  anchors: Record<AnchorKind, string | undefined>;
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

/**
 * The sources for one network's RPC endpoint.
 *
 * `legacyChainId` / `legacyRpcUrl` are the single-network pair
 * (`TEMPO_CHAIN_ID` / `TEMPO_RPC_URL`) that predates per-network config.
 */
export interface RpcSources {
  /** A per-network override — pins ONE network without touching the other. */
  perNetwork?: string;
  /** The chain id the legacy `TEMPO_CHAIN_ID` names, if it is set. */
  legacyChainId?: string;
  /** The legacy `TEMPO_RPC_URL`. */
  legacyRpcUrl?: string;
  /** The built-in default endpoint for the chain. */
  fallback?: string;
}

/**
 * The RPC a network uses, resolved from its sources — the PURE decision.
 *
 * `TEMPO_CHAIN_ID` and `TEMPO_RPC_URL` are a SINGLE-network pair: they name ONE
 * chain and the endpoint to read it from. They therefore apply to a network ONLY
 * when the chain id they name IS that network's chain id. Applying them
 * unconditionally is the bug this closes: with `TEMPO_CHAIN_ID` set to the
 * testnet, a mainnet config inherited the testnet `TEMPO_RPC_URL` — a mainnet
 * deployment would read and sign against the wrong chain — and the reverse
 * leaked a private mainnet endpoint into the practice config.
 *
 * Precedence, most specific first: a per-network override → the legacy pair,
 * but ONLY for the chain it names → the built-in default for the chain.
 */
export function pickRpcUrl(chainId: number, sources: RpcSources): string | undefined {
  const legacyApplies =
    sources.legacyChainId && Number(sources.legacyChainId) === chainId
      ? sources.legacyRpcUrl
      : undefined;
  return sources.perNetwork ?? legacyApplies ?? sources.fallback;
}

/**
 * The RPC a network uses, most specific first.
 *
 * The shared `TEMPO_RPC_URL` keeps its precedence for the chain it names (an
 * existing deploy sets it to point the live process at a private endpoint) and a
 * per-network variable lets an operator pin one network without disturbing the
 * other. Neither reaches across chains — see `pickRpcUrl`.
 */
function resolveRpcUrl(network: Network, chainId: number): string | undefined {
  const perNetwork = network === 'mainnet' ? env.TEMPO_MAINNET_RPC_URL : env.TEMPO_TESTNET_RPC_URL;
  return pickRpcUrl(chainId, {
    perNetwork,
    legacyChainId: env.TEMPO_CHAIN_ID,
    legacyRpcUrl: env.TEMPO_RPC_URL,
    fallback: getDefaultRpcUrl(chainId),
  });
}

/**
 * The token map for a network.
 *
 * Per-network override first, then the shared `TEMPO_TOKEN_*` value. Both are
 * validated non-empty: a missing token address would otherwise be signed as the
 * transfer's target, which is an unrecoverable payment to the wrong place.
 */
function buildTokenMap(network: Network): Record<SupportedAsset, `0x${string}`> {
  const prefixed = `TEMPO_${network.toUpperCase()}` as const;
  const envMap: Record<SupportedAsset, string | undefined> = {
    pathusd: env[`${prefixed}_TOKEN_PATHUSD` as keyof typeof env] as string | undefined,
    ousd: env[`${prefixed}_TOKEN_OUSD` as keyof typeof env] as string | undefined,
  };

  const shared: Record<SupportedAsset, string | undefined> = {
    pathusd: env.TEMPO_TOKEN_PATHUSD,
    ousd: env.TEMPO_TOKEN_OUSD,
  };

  const tokens = {} as Record<SupportedAsset, `0x${string}`>;
  for (const asset of SUPPORTED_ASSETS) {
    const value = envMap[asset] ?? shared[asset];
    if (!value) {
      throw new Error(`Missing token address env var for ${asset} on ${network}`);
    }
    tokens[asset] = value as `0x${string}`;
  }
  return tokens;
}

function resolveTreasury(network: Network): string {
  const perNetwork =
    network === 'mainnet' ? env.TEMPO_MAINNET_TREASURY_ADDRESS : env.TEMPO_TESTNET_TREASURY_ADDRESS;
  return perNetwork ?? env.SETI_TREASURY_ADDRESS;
}

/**
 * The pinned anchor defaults, used when no env value pins one.
 *
 * These are the receipts documented in `.env.example`: the Moderato OUSD batch
 * (`check:payout`) and the Moderato pathUSD batch (`check:send`/`check:quote`).
 */
const ANCHOR_DEFAULTS: Record<Network, Record<AnchorKind, string | undefined>> = {
  testnet: {
    payout: '0x8e9c2ba14b14e046bdec1974eb119c4b7137a437ddd538d22038303c5b4aa78d',
    send: '0xfbbacc1e13943afd4627bdd848b945f4de706d5726679d9f16612693d9aa7c70',
    quote: '0xfbbacc1e13943afd4627bdd848b945f4de706d5726679d9f16612693d9aa7c70',
  },
  // No mainnet anchor exists until the mainnet flip lands its proof. Left
  // undefined on purpose: pinning a Moderato hash here would make a mainnet suite
  // verify the wrong chain.
  mainnet: { payout: undefined, send: undefined, quote: undefined },
};

const SHARED_ANCHOR_ENV: Record<AnchorKind, string | undefined> = {
  payout: process.env.PAYOUT_ANCHOR_TX,
  send: process.env.SEND_ANCHOR_TX,
  quote: process.env.QUOTE_ANCHOR_TX,
};

function resolveAnchors(network: Network): Record<AnchorKind, string | undefined> {
  const prefixed = `TEMPO_${network.toUpperCase()}` as const;
  const anchors = {} as Record<AnchorKind, string | undefined>;

  for (const kind of ['payout', 'send', 'quote'] as const) {
    const perNetwork = env[`${prefixed}_${kind.toUpperCase()}_ANCHOR_TX` as keyof typeof env] as
      | string
      | undefined;
    anchors[kind] = perNetwork ?? SHARED_ANCHOR_ENV[kind] ?? ANCHOR_DEFAULTS[network][kind];
  }

  return anchors;
}

function buildNetworkConfig(network: Network): NetworkConfig {
  const isMainnet = network === 'mainnet';
  const chainId = isMainnet ? TEMPO_MAINNET_CHAIN_ID : TEMPO_TESTNET_CHAIN_ID;

  return {
    network,
    name: isMainnet ? 'tempo-mainnet' : 'tempo-testnet',
    chainId,
    displayName: isMainnet ? 'Tempo Mainnet' : 'Tempo Testnet (Moderato)',
    label: NETWORK_LABEL[network],
    rpcUrl: resolveRpcUrl(network, chainId) as string,
    wsUrl: isMainnet ? 'wss://rpc.mainnet.tempo.xyz' : 'wss://rpc.moderato.tempo.xyz',
    explorerUrl: isMainnet ? 'https://explore.tempo.xyz' : 'https://explore.testnet.tempo.xyz',
    isMainnet,
    bridgeEnv: isMainnet ? 'live' : 'sandbox',
    tokens: buildTokenMap(network),
    treasuryAddress: resolveTreasury(network),
    anchors: resolveAnchors(network),
  };
}

const networks: Record<Network, NetworkConfig> = {
  testnet: buildNetworkConfig('testnet'),
  mainnet: buildNetworkConfig('mainnet'),
};

/**
 * Which network this process SERVES.
 *
 * The server decides the network once, at boot, and never from a request: a
 * session's network is this value (an account may only act on a network the
 * deployment serves), so a client-supplied chain id has nothing to override.
 *
 * The mainnet opt-in is unchanged. An unset chain id defaults to testnet in
 * development and REFUSES in production; a mainnet chain id REFUSES unless
 * `ALLOW_MAINNET="true"`; and a non-zero indexer bootstrap lookback on mainnet
 * REFUSES, because it would write pre-existing chain history as fabricated
 * ledger rows.
 */
function resolveServedNetwork(): Network {
  const chainId = env.TEMPO_CHAIN_ID;

  if (!chainId) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'TEMPO_CHAIN_ID is required in production. Set it to the target Tempo network chain ID.'
      );
    }
    // Development falls back to the deployment's default network — but mainnet
    // STILL needs the opt-in. Without this a `DEFAULT_NETWORK=mainnet` dev box
    // would serve mainnet while the flag that exists to prevent exactly that is
    // unset, which is the hole `ALLOW_MAINNET` closes on the chain-id path.
    if (DEFAULT_NETWORK === 'mainnet' && env.ALLOW_MAINNET !== 'true') {
      throw new Error(
        'DEFAULT_NETWORK=mainnet but ALLOW_MAINNET is not set to "true". Set ALLOW_MAINNET=true ' +
          'explicitly after confirming you intend to operate on mainnet.'
      );
    }
    return DEFAULT_NETWORK;
  }

  const numericChainId = Number(chainId);
  const selected = networkForChainId(numericChainId);

  if (!selected) {
    throw new Error(
      `Unsupported Tempo chain ID: ${chainId}. Supported: ${TEMPO_MAINNET_CHAIN_ID} (mainnet), ${TEMPO_TESTNET_CHAIN_ID} (testnet).`
    );
  }

  if (selected === 'mainnet' && env.ALLOW_MAINNET !== 'true') {
    throw new Error(
      `Mainnet chain ID ${TEMPO_MAINNET_CHAIN_ID} detected but ALLOW_MAINNET is not set to "true". ` +
        'Set ALLOW_MAINNET=true explicitly after confirming you intend to operate on mainnet.'
    );
  }

  // A non-zero bootstrap lookback on mainnet fabricates ledger rows.
  //
  // With no cursor the indexer treats the lookback window as new activity and
  // writes pre-existing historical transfers to tracked addresses as `top_up`
  // rows — ledger entries no payment produced. `config/env.ts` defaults it to 0
  // (safe); this refuses the one combination that turns the setting into a
  // defect, so the mistake fails at boot rather than by writing bad history.
  if (selected === 'mainnet' && env.INDEXER_BOOTSTRAP_LOOKBACK > 0) {
    throw new Error(
      `INDEXER_BOOTSTRAP_LOOKBACK=${env.INDEXER_BOOTSTRAP_LOOKBACK} on mainnet (chain ` +
        `${TEMPO_MAINNET_CHAIN_ID}) would write pre-existing chain history as new \`top_up\` ` +
        'rows — ledger entries no payment produced. Keep it at 0 on mainnet and seed the ' +
        'indexer cursor to the current chain head instead (see docs/operations.md).'
    );
  }

  return selected;
}

/** The network this deployment serves — decided once, here, by the server. */
export const servedNetwork: Network = resolveServedNetwork();

// ---------------------------------------------------------------------------
// RPC ⇄ network coherence — the STATIC boot guard (applied at module load)
// ---------------------------------------------------------------------------
//
// The pure decision — and tonight's incident it closes — live in
// `config/rpc-coherence.ts`. This is where it is APPLIED: at module load, with no
// network, in the same place and shape as the production refusals in
// `config/env.ts`. The server, the indexer and every CLI therefore reach it
// before any of them can read or sign anything. It raises a typed error and
// there is no override flag — an incoherent pairing must be impossible to serve,
// not merely discouraged.
//
// What it CANNOT decide offline is whether the endpoint's OWN chain id agrees;
// that is a network fact and lives in the runtime guard in `services/chain.ts`
// (`ensureServedChainId`), which fails closed on first use and is deliberately
// NOT a boot requirement.

export {
  IncoherentRpcConfigError,
  evaluateRpcCoherence,
  maskEndpoint,
  networkForEndpoint,
  otherNetwork,
  type RpcCoherence,
  type RpcCoherenceInput,
} from './rpc-coherence.js';

/**
 * Refuse to start on an incoherent RPC/network pairing. Runs at MODULE LOAD, so
 * the server, the indexer and every CLI reach it before they can serve anything.
 * No network access is involved — this is the check that catches tonight's bug
 * with the cable unplugged.
 */
function assertCoherentRpcConfig(): void {
  const verdict = evaluateRpcCoherence({
    servedNetwork,
    endpoints: { testnet: networks.testnet.rpcUrl, mainnet: networks.mainnet.rpcUrl },
    legacyChainId: env.TEMPO_CHAIN_ID,
    legacyRpcUrl: env.TEMPO_RPC_URL,
  });
  if (!verdict.coherent) throw new IncoherentRpcConfigError(verdict);
}

assertCoherentRpcConfig();

/** Every network's config, for code that must speak about more than the served one. */
export const NETWORK_CONFIGS: Record<Network, NetworkConfig> = networks;

export function networkConfigFor(network: Network): NetworkConfig {
  return networks[network];
}

/** The treasury address of a network, for the fee leg of a batch on that network. */
export function treasuryAddressFor(network: Network = servedNetwork): string {
  return networks[network].treasuryAddress;
}

/** A pinned check-anchor receipt for a network, or undefined when none is pinned. */
export function anchorFor(network: Network, kind: AnchorKind): string | undefined {
  return networks[network].anchors[kind];
}

/** The served network's config — the default export every existing caller reads. */
export const network: NetworkConfig = networks[servedNetwork];

/** NETWORKS re-exported so a consumer needs one import for the vocabulary. */
export { NETWORKS };
export type { Network };

/** A 20-byte hex address, the only shape a treasury may have. */
const TREASURY_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
/** The zero address, spelled once. It is a valid address AND a burn destination. */
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;

/**
 * Whether an address can receive the platform fee.
 *
 * A blank, malformed or zero address cannot: the zero address is a valid
 * 20-byte address and a BURN destination, so a fee sent there is destroyed while
 * `recordPayment`/`recordSend` verify the Transfer as legitimately collected and
 * the ledger reports revenue nobody can spend. `config/env.ts` also refuses these
 * at boot; this predicate is what the READINESS gate re-applies, so the gate
 * stands on its own rather than depending on the boot check having run.
 */
export function isUsableTreasury(address: string | null | undefined): boolean {
  if (!address) return false;
  if (!TREASURY_ADDRESS_PATTERN.test(address)) return false;
  return address.toLowerCase() !== ZERO_ADDRESS;
}

/**
 * Whether this deployment can move LIVE money, and if not, the reason a person
 * reads.
 *
 * The gate `docs/internal/mainnet-flip.md` already writes: until ONE real
 * mainnet batch receipt (chain 4217, both legs) exists, the batched fee path is
 * designed but never executed on the chain that holds the funds. So Live is
 * refused with a STATED REASON — never a bare disabled control — until ALL of
 * these hold: this process serves mainnet, the mainnet opt-in is on, the mainnet
 * TREASURY is a real address the fee can be sent to, and the proof hash is set.
 *
 * The treasury condition is not pedantry. The fee leg of every batched payment
 * pays `networks.mainnet.treasuryAddress`; a blank, malformed or zero address
 * there would send the platform fee nowhere while the receipt counted it as
 * collected. Live therefore never opens until that address is well-formed and is
 * not the zero address.
 */
export interface MainnetReadiness {
  ready: boolean;
  /** A sentence naming the missing precondition. Null when ready. */
  reason: string | null;
}

/** The inputs the readiness gate decides on — separated so every refusal is pinnable. */
export interface MainnetReadinessInput {
  /** Whether THIS deployment serves mainnet. */
  servesMainnet: boolean;
  /** The served network's display name, for the refusal sentence. */
  servedDisplayName: string;
  /** The served network's chain id, for the refusal sentence. */
  servedChainId: number;
  /** `ALLOW_MAINNET === 'true'`. */
  allowMainnet: boolean;
  /** The address the mainnet fee leg would pay. */
  mainnetTreasury: string | undefined;
  /** `MAINNET_BATCH_PROOF_TX` — the hash of a real mainnet batch receipt. */
  mainnetProofTx: string | undefined;
}

/**
 * The readiness verdict for these inputs — the PURE decision.
 *
 * Factored out of `mainnetReadiness` so a check can drive each condition
 * independently and pin every refusal, including the ones a correctly-running
 * process can never reach on its own box (a served-mainnet deployment with a
 * blank treasury, say).
 */
export function evaluateMainnetReadiness(input: MainnetReadinessInput): MainnetReadiness {
  if (!input.servesMainnet) {
    return {
      ready: false,
      reason:
        `This deployment serves ${input.servedDisplayName} (chain ${input.servedChainId}), so it cannot ` +
        'settle live payments. Live becomes available when a mainnet deployment is running.',
    };
  }

  if (!input.allowMainnet) {
    return {
      ready: false,
      reason:
        'Mainnet is not enabled on this deployment. Set ALLOW_MAINNET=true deliberately before ' +
        'operating on mainnet.',
    };
  }

  if (!isUsableTreasury(input.mainnetTreasury)) {
    return {
      ready: false,
      reason:
        'The mainnet treasury address is missing, malformed, or the zero (burn) address, so the ' +
        'platform fee would be sent nowhere. Live stays unavailable until ' +
        'TEMPO_MAINNET_TREASURY_ADDRESS (or SETI_TREASURY_ADDRESS) is the mainnet address that ' +
        'should receive the fee.',
    };
  }

  if (!input.mainnetProofTx) {
    return {
      ready: false,
      reason:
        'No mainnet batch proof has landed. Live stays unavailable until one real mainnet ' +
        'transaction carries both legs — the recipient principal AND the fee to the treasury — ' +
        'in a single receipt (see docs/internal/mainnet-flip.md, step 8). A batched fee path ' +
        'proved only on Moderato is a promise, not proof.',
    };
  }

  return { ready: true, reason: null };
}

export function mainnetReadiness(): MainnetReadiness {
  return evaluateMainnetReadiness({
    servesMainnet: servedNetwork === 'mainnet',
    servedDisplayName: network.displayName,
    servedChainId: network.chainId,
    allowMainnet: env.ALLOW_MAINNET === 'true',
    mainnetTreasury: networks.mainnet.treasuryAddress,
    mainnetProofTx: env.MAINNET_BATCH_PROOF_TX,
  });
}

export function getExplorerTxUrl(txHash: string): string {
  return `${network.explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${network.explorerUrl}/address/${address}`;
}
