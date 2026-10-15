'use client';

import { useAccountIdentity } from '@/lib/account';
import { NETWORK_LABEL, normalizeNetwork, type Network } from '@/lib/network';
import { DEPLOYMENT_NETWORK } from '@/lib/chain';

/**
 * The network the app chrome is showing, and whether that makes the frame LOUD.
 *
 * The chrome reads the network from the SAME account read the gate and the
 * Profile card read, so the rail, the frame and the Profile control cannot
 * disagree about which network is on screen. Until that read answers, the
 * DEFAULT is the network this deployment serves — not a hardcoded Practice — so
 * a live build does not flash a practice frame it will remove.
 *
 * `practice` is the loud flag: on testnet the app says so, in the chrome and in
 * the frame, because a screenshot of a practice payment must not be mistakable
 * for a live one.
 */
export interface AppNetworkState {
  /** The served network, or the deployment's own network while it is unknown. */
  network: Network;
  /** True when the app is in PRACTICE mode — the state the chrome must shout. */
  practice: boolean;
  /** The network's product word: Practice | Live. */
  label: string;
}

export function useAppNetwork(): AppNetworkState {
  const account = useAccountIdentity();
  const network = account.identity
    ? normalizeNetwork(account.identity.network)
    : DEPLOYMENT_NETWORK;

  return {
    network,
    practice: network === 'testnet',
    label: account.identity?.networkLabel ?? NETWORK_LABEL[DEPLOYMENT_NETWORK],
  };
}
