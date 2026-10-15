/**
 * The network vocabulary, mirrored from `backend/src/lib/network.ts`.
 *
 * A Seti account practises on testnet and goes live on mainnet, and the two are
 * different WORLDS of data: a name claimed while practising is a different claim
 * from the same name on live, a practice payment and a live payment are different
 * ledgers, and a receipt from one names the other as its network. So the app has
 * one word for which network it is showing, and this is it.
 *
 * The server decides it (the session's network) and the app only READS it: there
 * is no path here that lets the browser assert a chain id, which is the rule the
 * backend's `middleware/network-scope.ts` enforces.
 */

export type Network = 'testnet' | 'mainnet';

export const NETWORKS: readonly Network[] = ['testnet', 'mainnet'];

/** The product's word for a network — the word a person reads. */
export const NETWORK_LABEL: Record<Network, string> = {
  testnet: 'Practice',
  mainnet: 'Live',
};

/**
 * A one-line description of what a network's money is, said plainly.
 *
 * It does NOT name the network: the app's word for the network is
 * `NETWORK_LABEL` and it is always rendered beside this sentence (the frame's
 * strip, the switch's selected button). Repeating the word inside the sentence is
 * how one screen ended up saying "Practice" four times.
 */
export const NETWORK_NOTE: Record<Network, string> = {
  testnet: 'Nothing here moves real money.',
  mainnet: 'Real money, on Tempo mainnet.',
};

export function isNetwork(value: unknown): value is Network {
  return value === 'testnet' || value === 'mainnet';
}

/** A stored value this build does not recognise reads as the practice default. */
export function normalizeNetwork(stored: string | null | undefined): Network {
  return isNetwork(stored) ? stored : 'testnet';
}
