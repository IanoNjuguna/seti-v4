import type { Address } from 'viem';
import type { AccountWalletRow } from '@/lib/api/wallets.types';
import type { EmbeddedWalletStatus } from '@/hooks/useEmbeddedWallet.types';

/**
 * Which address the browser signs with, and whether it can sign at all.
 *
 * ## The two sources, and why they are not one
 *
 * `useWallets()` is the only thing that can hand out a signing PROVIDER, so a
 * wallet it lists always wins. It is not, however, the only evidence that the
 * account has a wallet:
 *
 *  - the browser's own list lags. `lib/auth/privy-email-sign-in.ts` creates a
 *    wallet headlessly during sign-in and documents that the list catches up a
 *    render later — and, when it does not catch up at all, the app went blind to a
 *    wallet the server had had all along;
 *  - `/auth/verify` REFUSES a walletless account (`resolveWalletAddress` in
 *    `backend/src/services/wallet-registry.ts`), so a session that is signed in
 *    already proves the account has a registered address.
 *
 * The registered address is a fact, so it is read (`GET /users/:id/wallets`) and
 * used as the second source. It is the address inside the signed bytes, which is
 * what the claim binds — signing for an address the account does not hold is
 * what the backend refuses as `address-not-owned`.
 *
 * ## The precedence, and the one thing it never does
 *
 *  1. **Privy's wallet.** It is the only one that can produce a signature, and a
 *     list that HAS one has caught up.
 *  2. **The account's registered wallet** — but only for a SIGNED-IN session.
 *     Without a session the read does not apply, and an address with no account
 *     behind it would be a claim made for nobody.
 *
 * It never invents an address and never prefers the account's over a wallet the
 * browser actually holds: choosing the former would send a signature to an address
 * whose key this device may not have.
 */
export interface EmbeddedWalletResolution {
  status: EmbeddedWalletStatus;
  address: Address | null;
}

export interface EmbeddedWalletInput {
  /** `useWallets().ready`. Until it is true the list is not an answer yet. */
  ready: boolean;
  /** Whether the SERVER confirmed an account, which is what makes its read usable. */
  signedIn: boolean;
  /** The address of the wallet Privy lists, or null when it lists none. */
  privyAddress: Address | null;
  /** The address the account's own wallet rows name, or null when it holds none. */
  accountAddress: Address | null;
}

export function resolveEmbeddedWallet({
  ready,
  signedIn,
  privyAddress,
  accountAddress,
}: EmbeddedWalletInput): EmbeddedWalletResolution {
  // Still loading is a moment, not a verdict: report whatever address is already
  // known so a caller that reads it early is not told `null` twice for two
  // different reasons.
  if (!ready) {
    return { status: 'loading', address: privyAddress ?? accountAddress ?? null };
  }

  const address = privyAddress ?? (signedIn ? accountAddress : null);

  return { status: address ? 'ready' : 'missing', address };
}

/**
 * The address the account's wallet rows name, or null when it holds none.
 *
 * `status` is a preference, not a filter. The login path writes `deprecated` on a
 * row when it registers a different address, and a deprecated row still names an
 * address this account controls — `resolveSigningWallet` ignores status for the
 * same reason. So the ACTIVE row wins, and the newest of the rest is the fallback
 * rather than nothing: a device whose only wallet is a deprecated row can still
 * sign, and reporting `missing` there would wall it out for a label.
 */
export function registeredWalletAddress(wallets: AccountWalletRow[]): Address | null {
  const row = wallets.find((wallet) => wallet.status === 'active') ?? wallets[0];

  return row ? (row.address as Address) : null;
}
