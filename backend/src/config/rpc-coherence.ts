/**
 * RPC ⇄ network coherence — the PURE decision and its typed refusal.
 *
 * Kept in its own module, free of `config/env` and any I/O, for one reason: the
 * decision is decidable OFFLINE, from the resolved endpoints alone, and a check
 * must be able to drive every branch without a network, a `.env`, or a database.
 * `config/networks.ts` imports this, evaluates it at module load, and refuses to
 * start on an incoherent pairing; the checks import THIS file directly.
 *
 * Tonight's incident, closed. `TEMPO_CHAIN_ID` was moved to 4217 (mainnet) while
 * the legacy `TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz` was left beside it.
 * `pickRpcUrl` matches the legacy pair on the chain it NAMES, so that pair named
 * 4217 and the (Moderato) endpoint was applied to mainnet: the deployment served
 * Live while READING practice — it read a Moderato receipt as its own and
 * advanced the `tempo-mainnet` indexer cursor against testnet blocks. Every
 * mechanism worked exactly as designed; the CONFIGURATION was incoherent and
 * nothing said so.
 *
 * What this CANNOT decide offline is whether the endpoint's OWN chain id agrees;
 * that is a network fact, so it lives in the runtime guard in `services/chain.ts`
 * (`ensureServedChainId`), which fails closed on first use and is deliberately
 * NOT a boot requirement.
 */
import {
  type Network,
  chainIdForNetwork,
  networkForChainId,
} from '../lib/network.js';

/** The other network — the one a network is never allowed to share an endpoint with. */
export function otherNetwork(network: Network): Network {
  return network === 'mainnet' ? 'testnet' : 'mainnet';
}

/**
 * Endpoint hosts whose network is known by NAME.
 *
 * An endpoint usually announces its chain (`…moderato…`, `…mainnet…`), but the
 * canonical mainnet host (`rpc.tempo.xyz`) does not, so the two Tempo hosts are
 * named explicitly. Classification only ever feeds a refusal MESSAGE and the
 * legacy-pair check; a host that gives no evidence is reported as unknown rather
 * than guessed.
 */
const KNOWN_ENDPOINT_NETWORKS: Record<string, Network> = {
  'rpc.tempo.xyz': 'mainnet',
  'rpc.mainnet.tempo.xyz': 'mainnet',
  'rpc.moderato.tempo.xyz': 'testnet',
  'rpc.testnet.tempo.xyz': 'testnet',
};

/**
 * Which network an endpoint belongs to, or null when it cannot be told.
 *
 * Keyword-based on the HOST, so an Alchemy pair (`tempo-mainnet…` /
 * `tempo-moderato…`) classifies without a table entry, and a custom private host
 * that says nothing is reported as unknown. Returns null on ambiguity (a host
 * that says BOTH) rather than picking one, so the guard refuses only what it can
 * prove.
 */
export function networkForEndpoint(endpoint: string | undefined | null): Network | null {
  if (!endpoint) return null;
  let host: string;
  try {
    host = new URL(endpoint).hostname.toLowerCase();
  } catch {
    host = endpoint.toLowerCase();
  }
  const known = KNOWN_ENDPOINT_NETWORKS[host];
  if (known) return known;
  const looksTestnet = /moderato|testnet/.test(host);
  const looksMainnet = /mainnet/.test(host);
  if (looksTestnet === looksMainnet) return null;
  return looksTestnet ? 'testnet' : 'mainnet';
}

/**
 * An endpoint with any embedded credential MASKED, for a message a person reads.
 *
 * A refusal that printed the endpoint verbatim would leak the RPC key into logs
 * and CI output. Keys sit in an Alchemy/Infura-style path (`/v2/<key>`,
 * `/v3/<key>`) or a query parameter (`?apikey=…`); both are masked here. The
 * masked form is for MESSAGES only — the raw endpoint is what the client dials.
 */
export function maskEndpoint(endpoint: string | undefined | null): string {
  if (!endpoint) return '(none)';
  return endpoint
    .replace(/\/(v[2-9])\/[^/?#]+/gi, '/$1/***')
    .replace(/([?&](?:api[-_]?key|apikey|key|token|access[-_]?key)=)[^&#]+/gi, '$1***');
}

/** The inputs the coherence verdict decides on — separated so every refusal is pinnable. */
export interface RpcCoherenceInput {
  /** The network this deployment serves. */
  servedNetwork: Network;
  /** Each network's RESOLVED endpoint (after per-network → legacy → default). */
  endpoints: Record<Network, string | undefined>;
  /** The chain id the legacy `TEMPO_CHAIN_ID` names, when set. */
  legacyChainId?: string;
  /** The legacy `TEMPO_RPC_URL`, when set (the other half of the pair). */
  legacyRpcUrl?: string;
}

/** The verdict, with everything a refusal must name already extracted. */
export interface RpcCoherence {
  coherent: boolean;
  /** The served network's chain id — named in every refusal. */
  servedChainId: number;
  /** The endpoint the refusal is about, masked. Null when coherent. */
  endpoint: string | null;
  /** The network that endpoint actually belongs to, when it can be told. */
  endpointNetwork: Network | null;
  /** A sentence naming the problem, or null when coherent. */
  reason: string | null;
}

/**
 * The coherence verdict for these inputs — the PURE decision.
 *
 * Two rules, in order of specificity:
 *
 *   (a) the legacy single-network pair must point at the chain it NAMES — a
 *       `TEMPO_CHAIN_ID` naming one network beside a `TEMPO_RPC_URL` that is the
 *       OTHER network's endpoint is the exact shape of tonight's incident;
 *   (b) no endpoint may be shared between the two networks — if the served
 *       network resolves to the same endpoint as the other network, one of them
 *       is necessarily reading the wrong chain.
 */
export function evaluateRpcCoherence(input: RpcCoherenceInput): RpcCoherence {
  const served = input.servedNetwork;
  const servedChainId = chainIdForNetwork(served);
  const other = otherNetwork(served);

  // (a) The legacy pair must point at the chain it names.
  if (input.legacyRpcUrl) {
    const namedNetwork =
      input.legacyChainId !== undefined ? networkForChainId(Number(input.legacyChainId)) : null;
    const endpointNetwork = networkForEndpoint(input.legacyRpcUrl);
    if (namedNetwork && endpointNetwork && namedNetwork !== endpointNetwork) {
      return {
        coherent: false,
        servedChainId,
        endpoint: maskEndpoint(input.legacyRpcUrl),
        endpointNetwork,
        reason:
          `the legacy pair TEMPO_CHAIN_ID=${input.legacyChainId} + TEMPO_RPC_URL names the ` +
          `${namedNetwork} network (chain ${chainIdForNetwork(namedNetwork)}), but that ` +
          `TEMPO_RPC_URL (${maskEndpoint(input.legacyRpcUrl)}) is the ${endpointNetwork} ` +
          `network's endpoint. A single-network pair may only carry the chain it names, so ` +
          `this pairs the ${endpointNetwork} endpoint with the ${namedNetwork} chain.`,
      };
    }
  }

  // (b) No endpoint may be shared across the two networks.
  const servedEndpoint = input.endpoints[served];
  const otherEndpoint = input.endpoints[other];
  if (servedEndpoint && otherEndpoint && servedEndpoint === otherEndpoint) {
    const endpointNetwork = networkForEndpoint(servedEndpoint);
    return {
      coherent: false,
      servedChainId,
      endpoint: maskEndpoint(servedEndpoint),
      endpointNetwork,
      reason:
        `the ${served} network (chain ${servedChainId}) resolves to ` +
        `${maskEndpoint(servedEndpoint)}, which is IDENTICAL to the ${other} network's ` +
        'endpoint. That endpoint belongs to ' +
        (endpointNetwork ? `the ${endpointNetwork} network` : 'no network this config can name') +
        `, so serving ${served} would read ${endpointNetwork ?? 'the wrong'} chain while ` +
        'reporting the served one.',
    };
  }

  return { coherent: true, servedChainId, endpoint: null, endpointNetwork: null, reason: null };
}

/**
 * A served RPC/network pairing that is incoherent — named and coded so a caller
 * (or a log-grepping operator) can tell it apart from an ordinary parse error.
 * Names the served chain id, the offending endpoint and the network that endpoint
 * belongs to, because every one of those is what an operator needs to fix it.
 */
export class IncoherentRpcConfigError extends Error {
  readonly code = 'INCOHERENT_RPC_CONFIG';
  /** The chain id this deployment serves. */
  readonly servedChainId: number;
  /** The offending endpoint, MASKED. */
  readonly endpoint: string;
  /** The network that endpoint actually belongs to, when it can be told. */
  readonly endpointNetwork: Network | null;

  constructor(verdict: RpcCoherence) {
    super(
      '[INCOHERENT_RPC_CONFIG] Refusing to start: the RPC endpoint does not belong to the ' +
        `network this deployment serves (chain ${verdict.servedChainId}).\n\n  - ${verdict.reason}\n\n` +
        'An incoherent RPC/network pairing must never be served: reads, receipts and the ' +
        'indexer would all run against the wrong chain while the deployment reports the served ' +
        'one. Point the endpoint variables at the served network and start again. This check ' +
        'has no bypass.'
    );
    this.name = 'IncoherentRpcConfigError';
    this.servedChainId = verdict.servedChainId;
    this.endpoint = verdict.endpoint ?? '(unknown)';
    this.endpointNetwork = verdict.endpointNetwork;
  }
}
