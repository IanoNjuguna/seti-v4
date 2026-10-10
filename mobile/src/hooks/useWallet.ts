import { usePrivy } from '@privy-io/expo';

interface WalletState {
  address: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Returns the user's embedded EOA address from Privy.
 *
 * In production this is the wallet that holds stablecoins on Tempo.
 * The private key never leaves the secure enclave / Trusted Execution
 * Environment managed by Privy.
 */
export function useWallet(): WalletState {
  const { user, isReady } = usePrivy();

  if (!isReady) {
    return { address: null, isLoading: true, error: null };
  }

  if (!user) {
    return { address: null, isLoading: false, error: 'Not authenticated' };
  }

  // Find the embedded Ethereum wallet created by Privy.
  const embedded = user.linked_accounts.find((account) => {
    if (account.type !== 'wallet') return false;
    const wallet = account as { wallet_client_type?: string; address?: string };
    return wallet.wallet_client_type === 'privy' && typeof wallet.address === 'string';
  });

  const address =
    (embedded as { address?: string } | undefined)?.address ?? null;

  return {
    address,
    isLoading: false,
    error: address ? null : 'No embedded wallet found',
  };
}
