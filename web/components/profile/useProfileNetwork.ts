'use client';

import { useCallback, useState } from 'react';
import { ApiError, setAccountNetwork } from '@/lib/api';
import { NETWORK_LABEL, normalizeNetwork, type LiveReadiness, type Network } from '@/lib/network';
import { DEPLOYMENT_NETWORK, DEPLOYMENT_SERVES_MAINNET } from '@/lib/chain';
import { useAccountIdentity } from '@/lib/account';
import { PROFILE_NETWORK_COPY } from './ProfileNetwork.constants';
import type { UseProfileNetworkReturn } from './ProfileNetwork.types';

/**
 * The initial Live state, matched to what the DEPLOYMENT serves.
 *
 * A build that does not serve mainnet can NEVER offer Live, so it disables the
 * option with the real reason from the first render rather than a generic one.
 * A build that does serve mainnet waits for the server's readiness — the control
 * cannot declare Live ready on its own authority — and shows the shared fallback
 * until that answer arrives.
 */
function initialLiveReadiness(): LiveReadiness {
  if (DEPLOYMENT_SERVES_MAINNET) return { ready: false, reason: null };
  return { ready: false, reason: PROFILE_NETWORK_COPY.practiceOnlyReason };
}

function toMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Could not switch network. Try again.';
}

/**
 * The account's network, and how to change it.
 *
 * The network is READ from the account (`GET /account`) — the same answer the
 * rest of the app is served under, so this card cannot say "Practice" while a
 * payment is signed on live. Switching WRITES the preference and adopts the
 * server's answer; it never asserts a chain id, which is the rule the backend
 * enforces (`middleware/network-scope.ts`).
 *
 * Live is disabled by TWO independent gates, and both must open for the control
 * to be usable:
 *
 *  1. the DEPLOYMENT must serve mainnet (`DEPLOYMENT_SERVES_MAINNET`, from the
 *     build's chain config) — a practice build can never offer Live, whatever
 *     the server would say; and
 *  2. the server must report the deployment mainnet-ready (`identity.live`),
 *     which is what carries the sentence naming the missing precondition.
 *
 * A refused switch (Live while the deployment is not mainnet-ready) surfaces the
 * server's REASON, not a generic failure: the whole point of the Live control is
 * that it says why it is unavailable.
 */
export function useProfileNetwork(): UseProfileNetworkReturn {
  const account = useAccountIdentity();
  const [switching, setSwitching] = useState<Network | null>(null);
  const [error, setError] = useState<string | null>(null);

  const identity = account.identity;
  const network = identity ? normalizeNetwork(identity.network) : DEPLOYMENT_NETWORK;

  const live: LiveReadiness = DEPLOYMENT_SERVES_MAINNET
    ? identity?.live ?? initialLiveReadiness()
    : {
        ready: false,
        reason: identity?.live?.reason ?? PROFILE_NETWORK_COPY.practiceOnlyReason,
      };

  const switchTo = useCallback(
    async (target: Network) => {
      if (target === network) return;

      // A practice deployment cannot serve Live, so do not even ask: the gate
      // belongs to the deployment, not to this request.
      if (target === 'mainnet' && !DEPLOYMENT_SERVES_MAINNET) {
        setError(PROFILE_NETWORK_COPY.practiceOnlyReason);
        return;
      }

      setSwitching(target);
      setError(null);

      try {
        account.apply(await setAccountNetwork(target));
      } catch (cause) {
        setError(toMessage(cause));
      } finally {
        setSwitching(null);
      }
    },
    [account, network]
  );

  return {
    network,
    networkLabel: identity?.networkLabel ?? NETWORK_LABEL[DEPLOYMENT_NETWORK],
    live,
    depositAddress: identity?.depositAddress ?? null,
    switching,
    error,
    switchTo,
  };
}
