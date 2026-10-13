'use client';

import { useWallets } from '@privy-io/react-auth';
import { useSendTransaction } from '@privy-io/react-auth/tempo';
import { useCallback, useMemo } from 'react';
import { PRIVY_APP_ID } from '@/components/providers/PrivyAppProvider.constants';
import type { SendTempoTransaction } from '@/lib/pay/build-transfer.types';
import { NoEmbeddedWalletError } from './useEmbeddedWallet.types';

export interface TempoSenderValue {
  /**
   * Signs and broadcasts ONE Tempo transaction (type 118) carrying every call it
   * is given, atomically. Resolves to the hash.
   */
  sendTempoTransaction: SendTempoTransaction;
}

/**
 * The batch signer.
 *
 * A batch is not an EIP-1193 `eth_sendTransaction`: Tempo's `calls` array is not
 * a standard transaction field, and viem's RPC formatter drops it, so passing
 * `calls` to the provider would silently send a transaction with no calls in it.
 * Privy exposes a purpose-built hook for the Tempo envelope
 * (`@privy-io/react-auth/tempo`), and this is the only place it is used.
 *
 * That makes this module the sibling of `useEmbeddedWallet`: the same wallet is
 * found by `walletClientType === 'privy'` (never `wallets[0]`, since Privy can
 * surface external and older HD wallets too), and the same no-Privy fallback
 * applies, because calling either hook outside `PrivyProvider` throws.
 */
function usePrivyTempoSender(): TempoSenderValue {
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  const wallet = useMemo(
    () => wallets.find((candidate) => candidate.walletClientType === 'privy') ?? wallets[0] ?? null,
    [wallets]
  );

  const sendTempoTransaction = useCallback<SendTempoTransaction>(
    async (request) => {
      if (!wallet) throw new NoEmbeddedWalletError();

      const { hash } = await sendTransaction({ transaction: request, wallet });

      if (!hash || typeof hash !== 'string') {
        throw new Error('The wallet returned no transaction hash.');
      }

      return hash;
    },
    [wallet, sendTransaction]
  );

  return { sendTempoTransaction };
}

/** With no Privy app configured there is no wallet, and no hook to read one from. */
function useNoTempoSender(): TempoSenderValue {
  const sendTempoTransaction = useCallback<SendTempoTransaction>(async () => {
    throw new NoEmbeddedWalletError();
  }, []);

  return { sendTempoTransaction };
}

/**
 * Chosen once at module scope, not inside a render — `PRIVY_APP_ID` is fixed for
 * a build, so only one implementation is ever used and hook order is identical
 * on every render. The same reason `useEmbeddedWallet` does it this way.
 */
export const useTempoSender: () => TempoSenderValue = PRIVY_APP_ID
  ? usePrivyTempoSender
  : useNoTempoSender;
