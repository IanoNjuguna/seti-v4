'use client';

import { useEffect, useState } from 'react';
import { ApiError, fetchDepositTarget } from '@/lib/api';
import type { DepositTarget } from '@/lib/api';
import { DEPLOYMENT_NETWORK } from '@/lib/chain';
import { normalizeNetwork } from '@/lib/network';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { eip681PaymentUri } from './address.constants';
import type { AddressState, UseReceiveAddressReturn } from './address.types';

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Could not load your deposit address.';
}

/**
 * The decision the surface renders — a PURE function of the three answers.
 *
 * Kept out of the component so the hazard this surface exists for is stated in
 * one readable place: the address is the SERVER's row for the network the
 * deployment serves, and two independent disagreements refuse it rather than
 * falling back to whatever the browser happens to hold.
 *
 * The client's embedded wallet is used as a CHECK, never as the source. It is the
 * wallet this browser would sign and read balances with, so if it is not the
 * address the account is registered with on the served network, the account and
 * the browser disagree about which wallet the account uses — the case a stale
 * build or a mismatched client chain produces.
 */
function deriveState(
  target: DepositTarget | null,
  error: string | null,
  clientAddress: string | null,
  walletStatus: 'loading' | 'ready' | 'missing'
): AddressState {
  if (error) return { status: 'unreachable', message: error };
  if (!target) return { status: 'loading' };

  const served = normalizeNetwork(target.network);

  // 1. The app's own build must serve the network the server answered with. A
  //    build for the other chain would put its chain id in the code and switch
  //    the sender's wallet to the wrong one.
  if (served !== DEPLOYMENT_NETWORK) {
    return {
      status: 'wrong-network',
      servedNetwork: served,
      servedLabel: target.networkLabel,
      buildNetwork: DEPLOYMENT_NETWORK,
    };
  }

  if (!target.address) {
    return { status: 'unavailable', network: served, networkLabel: target.networkLabel };
  }

  // 2. The browser's wallet must BE that address. While the wallet is still
  //    resolving this waits rather than assuming agreement, so a slow wallet
  //    cannot slip a code past the check.
  if (walletStatus === 'loading') return { status: 'loading' };

  if (clientAddress && clientAddress.toLowerCase() !== target.address.toLowerCase()) {
    return {
      status: 'address-mismatch',
      serverAddress: target.address,
      clientAddress,
    };
  }

  return {
    status: 'ready',
    address: target.address,
    network: served,
    networkLabel: target.networkLabel,
    chainId: target.chainId,
    payload: eip681PaymentUri(target.address, target.chainId),
  };
}

/**
 * The account's deposit address, verified against the account before it is shown.
 *
 * Read from `GET /account/deposit` — the server's active wallet for the network
 * THIS DEPLOYMENT SERVES — and cross-checked against the browser's own embedded
 * wallet. The address is never taken from the wallet: a client cannot know which
 * network the server is serving, and a stale build would name the wrong CHAIN to
 * send on and the wrong network view the deposit lands in. (The address itself is
 * an EVM address, so it exists on both chains; what the stale build gets wrong is
 * everything beside it.)
 *
 * State is written only from the promise callbacks, because
 * `react-hooks/set-state-in-effect` is an error in this package.
 */
export function useReceiveAddress(): UseReceiveAddressReturn {
  const { address: clientAddress, status: walletStatus } = useEmbeddedWallet();
  const [target, setTarget] = useState<DepositTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchDepositTarget()
      .then((answer) => {
        if (!active) return;
        setTarget(answer);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(toMessage(cause));
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    state: deriveState(target, error, clientAddress, walletStatus),
  };
}
