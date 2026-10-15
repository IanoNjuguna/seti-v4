import type { Network } from '@/lib/network';

/**
 * What the "by address" half can be in, TYPED — one variant per real outcome.
 *
 * The failure variants exist because the address is money: an address that cannot
 * be shown to belong to this account on the network this deployment serves is
 * worse than no address at all, so the surface states WHICH check failed rather
 * than rendering the next best address it happens to hold.
 *
 *  - `wrong-network` — the app's build serves a different network than the server.
 *    A stale build is a real way to have the sender put the money on the other
 *    chain, where the app's ledger and balance views do not look;
 *  - `address-mismatch` — the wallet in this browser is not the address this
 *    account is registered with on the served network. An EVM address exists on
 *    every chain, so this is not about the money being unreachable; it is that the
 *    browser would sign and read balances as a wallet the account is not
 *    registered as, so which address the account actually uses is not established;
 *  - `unavailable` — the server answered, and there is genuinely no address
 *    registered on that network yet;
 *  - `unreachable` — the check could not be made at all.
 */
export type AddressState =
  | { status: 'loading' }
  | {
      status: 'ready';
      /** The address, exactly as the server's wallet row holds it. */
      address: string;
      network: Network;
      /** The network's product word: Practice | Live. */
      networkLabel: string;
      chainId: number;
      /** The exact string the QR encodes — built here, printed verbatim. */
      payload: string;
    }
  | {
      status: 'wrong-network';
      servedNetwork: Network;
      servedLabel: string;
      buildNetwork: Network;
    }
  | { status: 'address-mismatch'; serverAddress: string; clientAddress: string }
  | { status: 'unavailable'; network: Network; networkLabel: string }
  | { status: 'unreachable'; message: string };

export type AddressReadyState = Extract<AddressState, { status: 'ready' }>;

/** Everything that is neither loading nor showing an address. */
export type AddressFailureState = Extract<
  AddressState,
  { status: 'wrong-network' | 'address-mismatch' | 'unavailable' | 'unreachable' }
>;

export interface AddressFailureProps {
  state: AddressFailureState;
}

export interface UseReceiveAddressReturn {
  state: AddressState;
}
