/**
 * The ONE network vocabulary.
 *
 * A Seti account practises on testnet and goes live on mainnet. Those are two
 * NETWORKS, not two chains of one network: a name claimed while practising must
 * be claimable on live, a practice quote must never settle a live payment, and
 * the ledger must never file one network's money under the other. That is why
 * `network` is a first-class dimension on Wallet, Handle and Transaction and why
 * every uniqueness rule is scoped by it.
 *
 * The two values are deliberately the PLAIN ones (`testnet` / `mainnet`) rather
 * than the chain names (`tempo-testnet` / `tempo-mainnet`). The chain name is a
 * PROPERTY of the network, resolved through `config/networks.ts`; storing it in
 * the rows would mean a chain rename rewrites history.
 *
 * This module holds no database and no chain, so the claim, the quote, the
 * session and the checks all read one definition and cannot drift. It reads
 * exactly ONE environment value — `DEFAULT_NETWORK` — because which network a
 * DEPLOYMENT defaults to is a property of the process, not of the data.
 */

export type Network = 'testnet' | 'mainnet';

export const NETWORKS: readonly Network[] = ['testnet', 'mainnet'];

/**
 * The network this DEPLOYMENT defaults to.
 *
 * Read from `DEFAULT_NETWORK` at module load, so one build can be the live
 * deployment (`DEFAULT_NETWORK=mainnet`) while a developer's box stays on
 * practice. The CODE default is `testnet`: a box that sets nothing cannot
 * default to real money, which is what AGENTS.md's "never default to mainnet in
 * development" protects. Only the exact string `mainnet` selects mainnet; every
 * other value — unset, blank, a typo — reads as `testnet`, the safe direction.
 *
 * `config/env.ts` additionally REFUSES TO BOOT when the value is neither
 * `mainnet` nor `testnet`, so a typo fails loudly on a real deployment rather
 * than silently serving practice.
 *
 * It seeds the served network when no chain id names one, and it is the fallback
 * for a stored value this build does not recognise. It never overrides an
 * explicit chain id or a stored network.
 */
export const DEFAULT_NETWORK: Network =
  process.env.DEFAULT_NETWORK?.trim() === 'mainnet' ? 'mainnet' : 'testnet';

/** The product's word for a network — the word a person reads. */
export const NETWORK_LABEL: Record<Network, string> = {
  testnet: 'Practice',
  mainnet: 'Live',
};

/**
 * The chain config name for a network — `tempo-testnet` / `tempo-mainnet`.
 *
 * The indexer cursor is keyed by this, so switching networks gets its own cursor
 * rather than inheriting an incompatible one.
 */
export const NETWORK_CHAIN_NAME: Record<Network, 'tempo-testnet' | 'tempo-mainnet'> = {
  testnet: 'tempo-testnet',
  mainnet: 'tempo-mainnet',
};

export const TEMPO_MAINNET_CHAIN_ID = 4217;
export const TEMPO_TESTNET_CHAIN_ID = 42431;

export function isNetwork(value: unknown): value is Network {
  return value === 'testnet' || value === 'mainnet';
}

/** The network a Tempo chain id names, or null when it is neither. */
export function networkForChainId(chainId: number): Network | null {
  if (chainId === TEMPO_MAINNET_CHAIN_ID) return 'mainnet';
  if (chainId === TEMPO_TESTNET_CHAIN_ID) return 'testnet';
  return null;
}

export function chainIdForNetwork(network: Network): number {
  return network === 'mainnet' ? TEMPO_MAINNET_CHAIN_ID : TEMPO_TESTNET_CHAIN_ID;
}

/**
 * A stored value this build does not recognise reads as the FALLBACK network.
 *
 * The fallback defaults to the deployment default, but every caller that can be
 * reached with the network OMITTED passes the network this deployment SERVES:
 * an account may only act on a network the deployment serves, so "which network
 * did you mean" has exactly one sane answer, and it is not the deployment's
 * nominal default when the two differ.
 */
export function normalizeNetwork(
  stored: string | null | undefined,
  fallback: Network = DEFAULT_NETWORK
): Network {
  return isNetwork(stored) ? stored : fallback;
}

/**
 * The template for the chain name a network's cursor is keyed by.
 *
 * Declared here rather than in the indexer so the check can build the two keys
 * without reaching into the store.
 */
export function cursorKeyFor(network: Network): string {
  return NETWORK_CHAIN_NAME[network];
}
