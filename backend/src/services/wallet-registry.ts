import { getAddress } from 'viem';
import { prisma } from '../lib/prisma.js';
import { describeEvmAddress } from '../lib/address.js';
import { normalizeNetwork, type Network } from '../lib/network.js';
import { servedNetwork } from '../config/networks.js';
import type { Wallet, WalletStatus } from '@prisma/client';
import type { PaymentRefusalCode } from './payment-refusal.js';

export interface RegisterWalletInput {
  userId: string;
  chain: string;
  asset: string;
  address: string;
  keyId?: string;
  /**
   * The network this address is registered ON.
   *
   * Optional so existing callers (login, the checks) read exactly as before: an
   * omitted network is the network this deployment SERVES — an account may only
   * act on a served network, so that is the only sane default. A LIVE deposit
   * address is a separate registration with `network: 'mainnet'`.
   */
  network?: Network;
}

/**
 * The user's active wallet for a network.
 *
 * Looked up WITHOUT the asset filter: one Tempo address holds pathUSD and OUSD
 * alike, and an address is unique per network, so `Wallet.asset` labels the
 * row's primary token and cannot enumerate them. Filtering on it refuses
 * transfers the address can make — see the same note in
 * `services/transactions.ts`. The `asset` argument is kept only so callers that
 * read a specific token balance can say which one they mean.
 *
 * SCOPED BY NETWORK, and that is the fix for a real hazard: a practice wallet and
 * a live wallet are different addresses, and reading the wrong one means reading
 * a balance from a chain the money is not on.
 */
export async function getActiveWallet(userId: string, network: Network = servedNetwork) {
  return prisma.wallet.findFirst({
    where: { userId, status: 'active', network },
  });
}

/** What Privy knows about a user, as far as wallet registration cares. */
export interface VerifiedWalletSet {
  /** Privy's own `user.wallet` — its primary, not necessarily what the app signs with. */
  walletAddress?: string;
  /** Every embedded wallet Privy lists for the user, in Privy's order. */
  embeddedWalletAddresses: string[];
}

/**
 * The address to register for a login, or the reason there is none.
 *
 * Order matters, and each step is a bug that actually happened:
 *
 *  1. the client's declared address, if Privy lists it for this user. Registering
 *     Privy's `wallet` while the browser signed with a different embedded wallet
 *     is what made a funded account read a balance of zero — the app was reading
 *     the balance of a wallet nobody uses.
 *  2. Privy's `wallet`.
 *  3. the first embedded wallet Privy lists.
 *
 * There is deliberately NO create-a-wallet step. Minting one during login gave a
 * user a second embedded wallet and registered THAT: the browser never held its
 * key, so it could never be spent from, and the balance of the wallet the
 * customer actually used went unread.
 *
 * A declared address is checked against Privy's list, so this is not a client
 * asserting its own identity — it is the client naming which of ITS OWN wallets it
 * will sign with, which only the browser can know.
 */
export function resolveWalletAddress(
  declared: string | undefined,
  verified: VerifiedWalletSet
): { address: string } | { complaint: string } {
  if (!declared) {
    const fallback = verified.walletAddress ?? verified.embeddedWalletAddresses[0];
    return fallback
      ? { address: getAddress(fallback) }
      : {
          complaint:
            'No embedded wallet is attached to this account. Sign in again so the app can create one.',
        };
  }

  const malformed = describeEvmAddress(declared);
  if (malformed) return { complaint: malformed };

  const owned = verified.embeddedWalletAddresses.some(
    (candidate) => candidate.toLowerCase() === declared.toLowerCase()
  );

  if (!owned) {
    return {
      complaint:
        'That wallet does not belong to this account. Sign out and back in so the app can register the right one.',
    };
  }

  return { address: getAddress(declared) };
}

export async function getWalletsByUser(userId: string, network?: Network) {
  return prisma.wallet.findMany({
    where: { userId, ...(network ? { network } : {}) },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
}

/** The two ways a declared signing address can fail, out of `PaymentRefusalCode`. */
export type SigningWalletRefusalCode = Extract<
  PaymentRefusalCode,
  'signer-not-declared' | 'signer-not-owned'
>;

/**
 * The wallet row for the address a record path DECLARED it signed with.
 *
 * The counterpart of {@link resolveWalletAddress} for the money path, and it
 * exists for the same reason: an account can hold SEVERAL embedded wallets, so
 * "the user's active wallet" is not the wallet that signed. Which one signed is
 * knowable only to the client — the browser picks a wallet to sign with — so the
 * client declares it, this checks the declaration against the wallets the account
 * actually holds, and the record path REFUSES rather than inventing one. Resolving
 * the address any other way is what bound a recorded transfer to a wallet that
 * did not sign it, which made the receipt's `mine` flags and its total wrong.
 *
 * Two deliberate differences from `resolveWalletAddress`:
 *
 * - The ownership check is against the caller's own `Wallet` ROWS, not Privy's
 *   linked-wallet list. This runs after the signature, on a request carrying no
 *   Privy session, and the registered rows are the durable record of which
 *   addresses the account holds.
 * - A row's STATUS is ignored. `deprecated` is what login does to a row when it
 *   registers a different address — it is not a statement that the key is gone,
 *   and the signing wallet is very often the deprecated row (that is exactly how
 *   this bug presented).
 *
 * A declared address is the client naming which of its own wallets it used; it is
 * never an assertion of identity. An address that is not one of the caller's
 * wallets is refused, as is a missing or unusable one — nothing is invented.
 */
export async function resolveSigningWallet(
  userId: string,
  declared: string | undefined,
  network: Network = servedNetwork
): Promise<
  { wallet: Wallet } | { code: SigningWalletRefusalCode; complaint: string }
> {
  if (!declared) {
    return {
      code: 'signer-not-declared',
      complaint:
        'This transfer does not say which wallet signed it, so it cannot be bound to ' +
        'one. Sign out and back in so the app can register the wallet it signs with.',
    };
  }

  const malformed = describeEvmAddress(declared);
  if (malformed) return { code: 'signer-not-owned', complaint: malformed };

  // Scoped to the SESSION's network: a wallet registered for practice is not a
  // wallet the account holds on live, and a row from the other network would
  // bind a live payment to a practice key.
  const wallets = await getWalletsByUser(userId, network);
  const owned = wallets.find(
    (candidate) => candidate.address.toLowerCase() === declared.toLowerCase()
  );

  if (!owned) {
    return {
      code: 'signer-not-owned',
      complaint:
        'That wallet does not belong to this account. Sign out and back in so the app ' +
        'can register the wallet it signs with.',
    };
  }

  return { wallet: owned };
}

export async function registerWallet(input: RegisterWalletInput) {
  const network = normalizeNetwork(input.network, servedNetwork);

  // `Wallet.address` is unique PER NETWORK (partial unique indexes
  // `wallets_address_<network>_key`), so the "already registered" guard must be
  // scoped by ADDRESS **and network**.
  //
  // It used to be scoped to `(userId, asset, status: 'active')`, which made a
  // DEPRECATED row invisible here while it still held the address in the index.
  // Re-registering that address therefore could never succeed: the guard saw
  // nothing, the insert hit the index, and the failure surfaced as a P2002
  // naming `wallet.create()` rather than the collision. Any real rotation or
  // recovery back to a prior address would have failed identically.
  //
  // Scoping by network is the second half: the SAME key may be registered for
  // practice and for live (they are two rows on two chains), so the guard must
  // not conflate them — exactly as it must not conflate a deprecated row with the
  // address it once held.
  const byAddress = await prisma.wallet.findFirst({
    where: { address: input.address, network },
  });

  if (byAddress && byAddress.userId !== input.userId) {
    // Two identities cannot share one address on one network, and silently taking
    // the row over would hand one user's wallet to another. Refuse loudly.
    throw new Error(
      `Wallet address ${input.address} is already registered to another user on ${network}.`
    );
  }

  // One transaction: the stand-down and the write land together, so a failure
  // part-way through (a competing registration, say) cannot leave the account
  // with no active wallet at all.
  return prisma.$transaction(async (tx) => {
    // Stand down this user's OTHER active wallet(s) ON THIS NETWORK.
    //
    // `wallets` allows at most one ACTIVE row per `(userId, asset, network)` — a
    // PARTIAL unique index per network
    // (`wallets_userId_asset_<network>_active_key`, migration
    // 20261014090000_network_scope, extending
    // 20261013210000_wallet_one_active_per_asset) — and any number of DEPRECATED
    // rows per asset. The row for the OTHER network is deliberately untouched: a
    // practice registration must not deprecate the live wallet.
    //
    // The asset set also covers the row being reused, in case it is labelled
    // with a different asset than the one being registered: reactivating it
    // would otherwise leave that asset with two active rows.
    const assets = byAddress ? [input.asset, byAddress.asset] : [input.asset];

    await tx.wallet.updateMany({
      where: {
        userId: input.userId,
        network,
        asset: { in: assets },
        status: 'active',
        ...(byAddress ? { id: { not: byAddress.id } } : {}),
      },
      data: { status: 'deprecated' },
    });

    if (byAddress) {
      // Re-registering an address the account already holds is a no-op.
      if (byAddress.status === 'active') return byAddress;

      // Same owner, previously deprecated address coming back into service.
      return tx.wallet.update({
        where: { id: byAddress.id },
        data: { status: 'active' },
      });
    }

    return tx.wallet.create({
      data: {
        userId: input.userId,
        chain: input.chain,
        asset: input.asset,
        address: input.address,
        keyId: input.keyId,
        status: 'active',
        network,
      },
    });
  });
}

export async function updateWalletStatus(
  walletId: string,
  status: WalletStatus
) {
  return prisma.wallet.update({
    where: { id: walletId },
    data: { status },
  });
}
