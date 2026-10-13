/**
 * Privy app configuration for the browser.
 *
 * The app id is public (it ships in the client bundle) and is NOT the secret:
 * the matching `PRIVY_APP_SECRET` belongs on the backend only, where it verifies
 * the tokens this app issues.
 *
 * `createOnLogin: 'users-without-wallets'` is what makes a fresh account able to
 * pay immediately — without it the user signs in and has nothing to sign with.
 */
import type { Chain } from 'viem';
import { tempoChain } from '@/lib/chain';

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

export const PRIVY_LOGIN_METHODS = ['email'] as const;

/**
 * The chains Privy's SDK is allowed to talk to, and the network the embedded
 * wallet sits on by default.
 *
 * Without these the SDK falls back to Ethereum mainnet, and every Tempo call
 * fails at the first step with `Unsupported chainId 42431` (PrivyConnectorError
 * 4901) — thrown while resolving the public client for the chain, before any
 * signature is requested. Tempo Moderato is not a "custom" chain for Privy: the
 * SDK imports `tempoModerato` from viem itself, it just has to be in this list.
 *
 * `tempoChain` is the repo's own chain object (`lib/chain`), so the RPC URL and
 * chain id stay the ones the rest of the app validates — not a second copy.
 */
export const PRIVY_SUPPORTED_CHAINS = [tempoChain] as unknown as Chain[];

export const PRIVY_DEFAULT_CHAIN = tempoChain as unknown as Chain;

export const PRIVY_CONFIG = {
  // Spread into a mutable array: Privy's `PrivyClientConfig.loginMethods` is a
  // mutable union array, so a readonly tuple (or `as const` on this object) is
  // rejected. `createOnLogin` keeps its own literal type.
  loginMethods: [...PRIVY_LOGIN_METHODS],
  // The casts above relax `as const` readonly-ness into Privy's mutable `Chain[]`
  // shape. The object itself is checked against viem's `Chain` where it is
  // defined, so the shape is verified; only the mutability differs.
  supportedChains: PRIVY_SUPPORTED_CHAINS,
  defaultChain: PRIVY_DEFAULT_CHAIN,
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets' as const,
    },
  },
};
