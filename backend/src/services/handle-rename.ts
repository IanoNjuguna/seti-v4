/**
 * The rename hold — what a person's OLD username keeps doing after they change it.
 *
 * ## The product decision this implements
 *
 * An account has ONE person name (the partial unique index
 * `handles_person_user_key`, migration `20261022090000_person_name_and_rename`),
 * and changing it is a rename: the new string is claimed with a signature and the
 * old one moves into `handle_releases`. The obvious thing to do with the old
 * string is free it immediately, and that is the thing that must not happen:
 *
 *  - a customer who shared `seti.live/u/akinyi` — on WhatsApp, on a deck, printed
 *    on a QR sticker — would open a 404 and conclude the person no longer exists;
 *  - a payer who had that name in their history could not tell whether the name
 *    was gone or had been taken by someone;
 *  - and the string would be free for whoever asked for it next, which is exactly
 *    the squatter the global person index exists to keep out of a trust surface.
 *
 * So the old string is HELD, not freed: for `RENAME_HOLD_DAYS` it keeps resolving
 * to the SAME account (the release row carries the address, the signature and the
 * network, so the name still reads as verified), nobody else can claim it, and the
 * account that renamed may switch back inside the window.
 *
 * The hold is DERIVED, not stored as an expiry column: `handle_releases.createdAt`
 * plus the one constant below — one source of truth for how long a name is held,
 * and no second datetime that can drift from the row it describes. It is also the
 * only reading of the release row's age, so nothing can extend a hold by editing a
 * field that the resolver never looks at.
 *
 * This module holds no claim logic and no HTTP. It is the shared half: the claim
 * path writes the hold, the resolver reads it, and the check asserts both — so the
 * three cannot disagree about how long 30 days is or what `reason = 'renamed'`
 * means.
 */
import { prisma } from '../lib/prisma.js';
import { normalizeNetwork, type Network } from '../lib/network.js';
import { servedNetwork } from '../config/networks.js';

/**
 * How long a renamed-away person name stays held to the same account.
 *
 * 30 days is the chosen value: long enough that a link somebody shared this month
 * still works, short enough that a dead name does not sit in the namespace for a
 * season. It is a whole month because that is the unit a person can hold in their
 * head — "my old name works for a month after I change it" — and because a name is
 * a payment address, so the cost of holding it too long is far lower than the cost
 * of dropping it early.
 */
export const RENAME_HOLD_DAYS = 30;

/**
 * The `HandleRelease.reason` of a HELD rename: the old string was live, so it is
 * held to the same account for `RENAME_HOLD_DAYS`.
 */
export const RENAME_RELEASE_REASON = 'renamed';

/**
 * The reason for a rename of a name that never resolved — a row with no signature,
 * such as a `reserved` first-refusal hold or a half-written claim. Nothing was ever
 * payable under it, so nothing is held: a hold here would make an unpublished name
 * resolvable, which an unsigned row deliberately is not.
 *
 * Deliberately NOT a prefix of `RENAME_RELEASE_REASON`, so a `startsWith` or an
 * equality filter can never conflate the two.
 */
export const RENAME_UNLIVE_RELEASE_REASON = 'renamed-unlive';

const MS_PER_DAY = 86_400_000;

/** When a hold created at `releasedAt` stops protecting the old string. */
export function renameHoldExpiresAt(releasedAt: Date): Date {
  return new Date(releasedAt.getTime() + RENAME_HOLD_DAYS * MS_PER_DAY);
}

/** True when a release row's hold has run out. */
export function isRenameHoldExpired(row: { createdAt: Date }, now: Date = new Date()): boolean {
  return now.getTime() >= renameHoldExpiresAt(row.createdAt).getTime();
}

/** The fields of a held rename that the resolver and the claim path both need. */
export interface RenameHold {
  id: string;
  handle: string;
  name: string;
  kind: string;
  address: string;
  purpose: string | null;
  network: string | null;
  claimSignature: string | null;
  claimIssuedAt: string | null;
  claimNonce: string | null;
  userId: string | null;
  createdAt: Date;
}

/**
 * The live hold on a handle string, or null.
 *
 * "Live" is `reason = 'renamed'` AND `createdAt` inside the window — the only two
 * facts that decide it, read from the row so a hold cannot be asserted into
 * existence. The NEWEST such row wins: an account that renamed away, came back and
 * renamed away again has two releases for one string, and the current hold is the
 * last one.
 *
 * This is the only reader of the hold. A caller must therefore never treat "no
 * row in `handles`" as "free" for a person name without asking this first.
 */
export async function findActiveRenameHold(
  handle: string,
  now: Date = new Date()
): Promise<RenameHold | null> {
  const cutoff = new Date(now.getTime() - RENAME_HOLD_DAYS * MS_PER_DAY);

  return prisma.handleRelease.findFirst({
    where: {
      handle: handle.toLowerCase(),
      reason: RENAME_RELEASE_REASON,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * A handle row a held string resolves AS.
 *
 * The shape `toHandleIdentityView` reads, built from the release row: the old
 * name, its address, its signature and the network that signature was made on, so
 * `/u/<old>` renders exactly what it rendered before the rename — including
 * `verified: true`. `reviewStatus` is null because a held string IS live; a rename
 * of a name that never resolved is recorded with the other reason and never
 * reaches here.
 *
 * `claimedAt` is null by design: the release row records when the name was GIVEN
 * UP, and reporting that as the claim date would put the rename date on a page that
 * claims to say when the person took the name.
 */
export function toHeldHandleRow(hold: RenameHold, fallbackNetwork: Network = servedNetwork) {
  return {
    id: hold.id,
    handle: hold.handle,
    kind: hold.kind,
    name: hold.name,
    address: hold.address,
    purpose: hold.purpose,
    claimSignature: hold.claimSignature,
    claimIssuedAt: hold.claimIssuedAt,
    claimNonce: hold.claimNonce,
    claimedAt: null,
    userId: hold.userId,
    merchantId: null,
    reviewStatus: null,
    reviewBrand: null,
    network: normalizeNetwork(hold.network, fallbackNetwork),
    merchant: null,
  };
}
