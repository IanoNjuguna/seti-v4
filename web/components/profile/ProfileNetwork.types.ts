import type { LiveReadiness, Network } from '@/lib/network';

export interface ProfileNetworkSwitchProps {
  /** The network the account is acting on. */
  network: Network;
  /** The network currently being written, or null. */
  switching: Network | null;
  /** Whether Live can be chosen at all, and why not when it cannot. */
  live: LiveReadiness;
  onSwitch: (network: Network) => void;
}

export interface UseProfileNetworkReturn {
  network: Network;
  /** The network's product word: Practice | Live. */
  networkLabel: string;
  live: LiveReadiness;
  depositAddress: string | null;
  switching: Network | null;
  error: string | null;
  switchTo: (network: Network) => Promise<void>;
}
