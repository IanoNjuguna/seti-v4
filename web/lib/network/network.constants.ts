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
 * Only PRACTICE carries one: the frame's strip says what a practice payment is,
 * and it renders nothing on Live, where the money needs no caption. The sentence
 * does NOT name the network — the app's word for it is `NETWORK_LABEL`, rendered
 * beside this line.
 */
export const NETWORK_NOTE: Partial<Record<Network, string>> = {
  testnet: 'Nothing here moves real money.',
};

export function isNetwork(value: unknown): value is Network {
  return value === 'testnet' || value === 'mainnet';
}

/** A stored value this build does not recognise reads as the practice default. */
export function normalizeNetwork(stored: string | null | undefined): Network {
  return isNetwork(stored) ? stored : 'testnet';
}
