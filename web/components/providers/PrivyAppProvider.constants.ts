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
import { DEPLOYMENT_NETWORK, tempoChainFor } from '@/lib/chain';
import type { Network } from '@/lib/network';

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

export const PRIVY_LOGIN_METHODS = ['email'] as const;

/** The network that is NOT the deployment's own — the one an account may switch to. */
const OTHER_NETWORK: Network = DEPLOYMENT_NETWORK === 'mainnet' ? 'testnet' : 'mainnet';

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
 * The list carries BOTH networks, not just the served one. The SDK resolves a
 * chain by id against this list, and the chain that gets signed is the ACCOUNT's
 * (`chainConfigFor` in `lib/pay/build-transfer.ts`) — so a build that serves live
 * must still have Moderato in the list for a practice account to sign at all.
 * Including the other network cannot widen what may be signed: `chainConfigFor`
 * refuses mainnet unless `NEXT_PUBLIC_ALLOW_MAINNET` is "true", so on a practice
 * build the second entry simply does not exist.
 *
 * `defaultChain` stays the deployment's own network — the one to sit on before any
 * account has answered.
 */
function supportedChains(): Chain[] {
  const chains: Chain[] = [tempoChainFor(DEPLOYMENT_NETWORK)];

  try {
    chains.push(tempoChainFor(OTHER_NETWORK));
  } catch {
    // The other network is not permitted in this build (mainnet with no opt-in).
    // Absent from the list on purpose: the same guard that refuses to sign it.
  }

  return chains;
}

export const PRIVY_SUPPORTED_CHAINS = supportedChains();

export const PRIVY_DEFAULT_CHAIN = tempoChainFor(DEPLOYMENT_NETWORK) as unknown as Chain;

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
  /**
   * No external wallets, and the reason is not only product scope.
   *
   * v1 never connects one: the customer signs with the embedded wallet Privy
   * creates on first login, and the send flow refuses any other signer. Left on,
   * the connector manager initialises on the first user gesture, probes for
   * injected providers and starts WalletConnect, and on the sign-in page that
   * initialisation never settles: the first real click or keystroke leaves React
   * re-rendering in a loop and the tab stops responding (issue #92, traced to
   * ~2,300 React calls a second with no app frame on the stack). A synthetic
   * click hides it, which is why every earlier test of the page passed.
   */
  externalWallets: {
    disableAllExternalWallets: true,
  },
};
