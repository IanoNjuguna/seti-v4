import { get, post } from './client';
import type { AccountWalletRow, AccountWalletsResponse } from './wallets.types';

/**
 * The wallets the ACCOUNT holds, as the server records them.
 *
 * ## Why the browser reads this at all
 *
 * A signing address is not something the client should have to remember from a
 * render. Privy's `useWallets()` is a view of the user object the SDK last
 * fetched, and `lib/auth/privy-email-sign-in.ts` documents the gap it opens: a
 * wallet created headlessly during sign-in is resolved by `createWallet()` while
 * the wallet LIST only catches up a render later. If it never catches up, the
 * account is fine on the server and the app is blind on the client, and the only
 * repair it used to offer was "sign in again".
 *
 * The address is a fact the server already holds (`getWalletsByUser`), so it is
 * read here rather than inferred from a render. This is a READ: nothing about it
 * can create a wallet, and an address it returns is the account's own.
 *
 * Scoped to the caller — the route refuses any id but the caller's own — and to
 * the session's network, because a practice address and a live address are
 * different addresses.
 */
export async function fetchAccountWallets(userId: string): Promise<AccountWalletRow[]> {
  const { wallets } = await get<AccountWalletsResponse>(
    `/users/${encodeURIComponent(userId)}/wallets`
  );

  return wallets;
}

/**
 * Record an address the BROWSER created, so the account holds it.
 *
 * Called from one place only: the repair path in `useEmbeddedWallet`, immediately
 * after the account was read and found to hold no wallet at all, and immediately
 * after `createWallet()` returned a key this browser holds.
 *
 * This is not minting and it is not custody. The key never leaves the browser —
 * the whole reason wallet creation is client-side — and this call does what the
 * next `/auth/verify` would do a moment later: name the address the account signs
 * with. It has to happen, because a claim binds a name to an ADDRESS and the
 * backend refuses one it has no row for (`address-not-owned`, see
 * `services/handle-claims.ts`), so a wallet created here and never registered is
 * a wallet the account cannot claim or pay with.
 *
 * The guard is the read above it: with any wallet already on the account, nothing
 * is created and nothing is registered, because a second address is exactly the
 * failure `backend/src/services/wallet-registry.ts` records.
 */
export async function registerAccountWallet(userId: string, address: string): Promise<void> {
  await post<{ wallet: AccountWalletRow }>(`/users/${encodeURIComponent(userId)}/wallets`, {
    address,
  });
}
