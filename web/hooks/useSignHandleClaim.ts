'use client';

import { useSignTypedData } from '@privy-io/react-auth';
import { useCallback } from 'react';
import {
  buildHandleClaim,
  buildHandleClaimMessage,
} from '@/lib/pay/sign-handle-claim';
import { PRIVY_APP_ID } from '@/components/providers/PrivyAppProvider.constants';
import { useEmbeddedWallet } from './useEmbeddedWallet';
import { NoEmbeddedWalletError } from './useEmbeddedWallet.types';
import type { HandleClaimSignature } from '@/lib/pay/sign-handle-claim.types';
import type { SignHandleClaimInput, SignHandleClaimValue } from './useSignHandleClaim.types';

/**
 * Sign a handle claim with the embedded wallet.
 *
 * ## The sibling of `useTempoSender`, and for the same reason
 *
 * Payments already learned this: the batch is signed through Privy's Tempo hook
 * and never through an EIP-1193 provider, because the provider cannot carry what a
 * batch needs and would fail in a way the app could not name. The claim was the
 * last signer left on `wallet.getEthereumProvider()` plus a hand-rolled
 * `eth_signTypedData_v4`, and it failed exactly like that: Privy's provider refuses
 * a typed-data request in at least six different places ("No embedded or connected
 * wallet found for address", "User must be authenticated before signing", "Unable
 * to connect to wallet", "Disconnected" 4900, "Invalid params", "Unable to sign
 * message"), each a plain `Error` with no code, all of them landing in the claim's
 * single catch. A new account never got past onboarding because of it.
 *
 * `useSignTypedData` is the supported path for an embedded wallet. It resolves the
 * wallet itself, returns `{ signature }`, and reports its own typed failures. The
 * BYTES are unchanged: `buildHandleClaimMessage` still decides them, and
 * `buildHandleClaim` still wraps them in the domain the backend verifies against.
 *
 * ## The address is one value, used twice
 *
 * The claim binds the handle to the address that will receive payments, so the
 * `address` inside the signed message and the wallet asked to sign come from the
 * same place. Two lookups would be two chances to sign for one wallet and claim
 * for another; the backend refuses that (`address-not-owned`), which is a correct
 * refusal for a bug nobody should have to see.
 *
 * ## Nothing is read from captured state after an `await`
 *
 * The name and kind are taken into locals before the first await, so a re-render
 * mid-flight cannot change what is being signed.
 */
function usePrivySignHandleClaim(): SignHandleClaimValue {
  // One wallet-selection rule for the claim, the payment and the save flow:
  // `walletClientType === 'privy'`. Never `wallets[0]`, which can be an external
  // wallet or an older HD index.
  const { status, canSign, address } = useEmbeddedWallet();
  const { signTypedData } = useSignTypedData();

  const sign = useCallback(
    async (input: SignHandleClaimInput): Promise<HandleClaimSignature> => {
      if (!address) throw new NoEmbeddedWalletError();

      const message = buildHandleClaimMessage({
        kind: input.kind,
        name: input.name,
        address,
      });

      const { signature } = await signTypedData(buildHandleClaim(message), { address });

      if (!signature || typeof signature !== 'string') {
        throw new Error('The wallet returned no signature for the claim.');
      }

      return { message, signature };
    },
    [address, signTypedData]
  );

  return { status, canSign, sign };
}

/** With no Privy app there is no embedded wallet and no hook to sign with. */
function useNoSignHandleClaim(): SignHandleClaimValue {
  const sign = useCallback(async (): Promise<HandleClaimSignature> => {
    throw new NoEmbeddedWalletError();
  }, []);

  return { status: 'missing', canSign: false, sign };
}

/**
 * Chosen once at module scope, not inside a render: `PRIVY_APP_ID` is fixed for a
 * build, so only one implementation is ever used and hook order is identical on
 * every render. Same reason `useEmbeddedWallet` and `useTempoSender` do it this way.
 */
export const useSignHandleClaim: () => SignHandleClaimValue = PRIVY_APP_ID
  ? usePrivySignHandleClaim
  : useNoSignHandleClaim;
