import type { AccountIntent, HandleIdentity } from '@/lib/api';
import type { Network } from '@/lib/network';

/**
 * What the network row renders.
 *
 * `value` is passed in rather than derived here because the chain's name has one
 * source (`CHAIN_NAME`), and the row must not be a second place that writes it.
 */
export interface ProfileNetworkSectionProps {
  network: Network;
  /** The chain the account acts on, in the app's one word for it (`CHAIN_NAME`). */
  value: string;
  /** The live deposit address, or null when the account has none. */
  depositAddress: string | null;
  /** Why the last network switch failed, when one did. */
  error: string | null;
}

/** What the mode row renders. */
export interface ProfileModeSectionProps {
  /** The mode the account is acting as. */
  intent: AccountIntent;
  /** The mode being written, or null. */
  switching: AccountIntent | null;
  /** The handle the account holds for that mode, or null when it holds none. */
  handle: HandleIdentity | null;
  /** Why the last mode switch failed, when one did. */
  error: string | null;
  onSwitch: (intent: AccountIntent) => void;
}
