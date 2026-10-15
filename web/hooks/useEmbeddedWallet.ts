'use client';

import { useWallets } from '@privy-io/react-auth';
import { useCallback, useMemo } from 'react';
import type { Address, EIP1193Provider } from 'viem';
import { tempoChainFor } from '@/lib/chain';
import { useAppNetwork } from '@/components/app/useAppNetwork';
import { PRIVY_APP_ID } from '@/components/providers/PrivyAppProvider.constants';
import {
  NoEmbeddedWalletError,
  type EmbeddedWalletValue,
  type SigningWallet,
} from './useEmbeddedWallet.types';

/**
 * The Privy-backed embedded wallet, ready to sign a Tempo transaction.
 *
 * Privy can surface several wallets (external ones, older HD indices), so the
 * embedded one is picked explicitly by `walletClientType === 'privy'` rather than
 * taking `wallets[0]` and hoping.
 */
function usePrivyEmbeddedWallet(): EmbeddedWalletValue {
  const { wallets, ready } = useWallets();
  /**
   * The network the ACCOUNT is acting on. The wallet is switched to it before
   * signing, so a practice account is not first moved onto the live chain — the
   * deployment's chain is the wrong answer here for the same reason it is on the
   * signing path itself.
   */
  const { network } = useAppNetwork();

  const wallet = useMemo(
    () => wallets.find((candidate) => candidate.walletClientType === 'privy') ?? wallets[0] ?? null,
    [wallets]
  );

  const getSigningWallet = useCallback(async (): Promise<SigningWallet> => {
    if (!wallet) throw new NoEmbeddedWalletError();

    try {
      // Ask for the Tempo chain first: the embedded wallet may be sitting on
      // another one, and signing for the wrong chain is a silent money bug. Not
      // fatal if it fails — the transaction carries its own chainId, and some
      // providers report the chain as already-set this way.
      await wallet.switchChain(tempoChainFor(network).id);
    } catch {
      // Fall through: the tx below is chain-specific anyway.
    }

    const provider = (await wallet.getEthereumProvider()) as EIP1193Provider;
    return { provider, address: wallet.address as Address };
  }, [wallet, network]);

  return {
    status: !ready ? 'loading' : wallet ? 'ready' : 'missing',
    address: (wallet?.address as Address | undefined) ?? null,
    getSigningWallet,
  };
}

/**
 * With no Privy app configured there is no embedded wallet, and no provider to
 * read one from — calling `useWallets` outside `PrivyProvider` throws.
 */
function useNoEmbeddedWallet(): EmbeddedWalletValue {
  const getSigningWallet = useCallback(async (): Promise<SigningWallet> => {
    throw new NoEmbeddedWalletError();
  }, []);

  return { status: 'missing', address: null, getSigningWallet };
}

/**
 * Chosen once at module scope, not inside a render.
 *
 * `PRIVY_APP_ID` is fixed for a build, so only one implementation is ever used and
 * hook order is identical on every render — the reason this is a module-level
 * ternary rather than a condition inside the hook body, which `react-hooks/rules-of-hooks`
 * rejects (rightly).
 */
export const useEmbeddedWallet: () => EmbeddedWalletValue = PRIVY_APP_ID
  ? usePrivyEmbeddedWallet
  : useNoEmbeddedWallet;
