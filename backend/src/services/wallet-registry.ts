import { getAddress } from 'viem';
import { prisma } from '../lib/prisma.js';
import { describeEvmAddress } from '../lib/address.js';
import type { Wallet, WalletStatus } from '@prisma/client';
import type { PaymentRefusalCode } from './payment-refusal.js';

export interface RegisterWalletInput {
  userId: string;
  chain: string;
  asset: string;
  address: string;
  keyId?: string;
}

/**
 * The user's active wallet for an asset.
 *
 * Looked up WITHOUT the asset filter: one Tempo address holds pathUSD and OUSD
 * alike, and `Wallet.address` is globally unique, so `Wallet.asset` labels the
 * row's primary token and cannot enumerate them. Filtering on it refuses
 * transfers the address can make — see the same note in
 * `services/transactions.ts`. The `asset` argument is kept only so callers that
 * read a specific token balance can say which one they mean.
 */
export async function getActiveWallet(userId: string, _asset?: string) {
  return prisma.wallet.findFirst({
    where: { userId, status: 'active' },
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

export async function getWalletsByUser(userId: string) {
  return prisma.wallet.findMany({
    where: { userId },
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
  declared: string | undefined
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

  const wallets = await getWalletsByUser(userId);
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
  // `Wallet.address` is GLOBALLY unique (`@@unique([address])`), so the
  // "already registered" guard must be scoped by ADDRESS.
  //
  // It used to be scoped to `(userId, asset, status: 'active')`, which made a
  // DEPRECATED row invisible here while it still held the address in the global
  // index. Re-registering that address therefore could never succeed: the guard
  // saw nothing, the insert hit the index, and the failure surfaced as a P2002
  // naming `wallet.create()` rather than the collision. Dev login was broken
  // exactly that way — its placeholder address was already held by a deprecated
  // row for the same user — and any real rotation or recovery back to a prior
  // address would have failed identically.
  const byAddress = await prisma.wallet.findUnique({
    where: { address: input.address },
  });

  if (byAddress && byAddress.userId !== input.userId) {
    // Two identities cannot share one address, and silently taking the row over
    // would hand one user's wallet to another. Refuse loudly instead.
    throw new Error(
      `Wallet address ${input.address} is already registered to another user.`
    );
  }

  // Stand down this user's other active wallet for the asset. `@@unique([userId,
  // asset, status])` allows only one active row per asset, so this has to happen
  // before either a reactivation or a fresh insert.
  await prisma.wallet.updateMany({
    where: {
      userId: input.userId,
      asset: input.asset,
      status: 'active',
      ...(byAddress ? { id: { not: byAddress.id } } : {}),
    },
    data: { status: 'deprecated' },
  });

  if (byAddress) {
    if (byAddress.status === 'active') return byAddress;

    // Same owner, previously deprecated address coming back into service.
    return prisma.wallet.update({
      where: { id: byAddress.id },
      data: { status: 'active' },
    });
  }

  return prisma.wallet.create({
    data: {
      userId: input.userId,
      chain: input.chain,
      asset: input.asset,
      address: input.address,
      keyId: input.keyId,
      status: 'active',
    },
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
