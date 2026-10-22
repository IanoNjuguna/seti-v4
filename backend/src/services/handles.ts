/**
 * Resolving a handle — the ONE lookup the whole product goes through.
 *
 * A person's username and a business's name live in the same table
 * (`handles.handle`, unique) and are found by the same functions here. There is
 * deliberately no separate "merchant" resolver: a second one would be a second
 * uniqueness rule, and one string could then mean two things.
 *
 * The lookups are `findUnique`/`findFirst` on the stored columns — never a
 * reverse-derivation from a name, because the handle rule DROPS characters, so
 * two names can share one handle and the stored column is what the claim refused
 * the second of. `merchant` is joined only to carry a business's profile
 * (`category`, and the id the money path pays); a person has none.
 */
import { prisma } from '../lib/prisma.js';
import { describeMerchantName, normalizeMerchantName } from '../lib/merchant-name.js';
import { servedNetwork, type Network } from '../config/networks.js';
import { findActiveRenameHold, toHeldHandleRow } from './handle-rename.js';

export interface QrPayload {
  type: 'merchant' | 'unknown';
  /**
   * The handle a QR carries: either the platform id, or — for anyone who
   * claimed a handle — the name itself, which is the handle the customer was
   * actually given. All are looked up through the same resolver.
   */
  merchantId?: string;
  amount?: string;
}

export function parseQrPayload(qrData: string): QrPayload {
  // Seti deep link: seti://pay?merchantId=abc&amount=250.00
  if (qrData.startsWith('seti://pay')) {
    const url = new URL(qrData);
    return {
      type: 'merchant',
      merchantId: url.searchParams.get('merchantId') ?? undefined,
      amount: url.searchParams.get('amount') ?? undefined,
    };
  }

  // Name deep link: seti://merchant?name=Java+House — a name contains spaces and
  // punctuation that a URL path or a bare id cannot express, so it gets its own
  // parameter rather than being smuggled through one.
  if (qrData.startsWith('seti://merchant')) {
    const url = new URL(qrData);
    const name = url.searchParams.get('name');
    return name ? { type: 'merchant', merchantId: normalizeMerchantName(name) } : { type: 'unknown' };
  }

  // Plain merchant ID prefixed with "merchant:"
  if (qrData.startsWith('merchant:')) {
    return {
      type: 'merchant',
      merchantId: qrData.replace('merchant:', ''),
    };
  }

  // A bare token: a platform merchant id, a handle, or a username. Handles use
  // `[a-z0-9._-]`, so `.` is part of the shape — a handle like `co.op` must reach
  // the handle lookup rather than being read as a name.
  if (/^[a-zA-Z0-9._-]{3,64}$/.test(qrData)) {
    return { type: 'merchant', merchantId: qrData };
  }

  // A name. Checked after the id shape above, because that shape deliberately
  // excludes spaces: a claimed handle IS a name, and refusing it here would make
  // a claimed handle unreachable by QR.
  if (describeMerchantName(qrData) === null) {
    return { type: 'merchant', merchantId: normalizeMerchantName(qrData) };
  }

  return { type: 'unknown' };
}

/** The business profile a handle may carry, selected wherever a handle is read. */
export const HANDLE_PROFILE_SELECT = {
  merchant: { select: { id: true, category: true } },
} as const;

/**
 * A handle by its stored string.
 *
 * `handle` is indexed, so this filters on that column — NOT a scan that
 * reverse-engineers handles from names. Handles are stored lowercase (the rule
 * lowercases), so a caller's mixed case is lowered to match rather than searched
 * case-insensitively, which would not use the index.
 *
 * `reviewStatus: null` is the whole of the protection on the read side: a
 * `reserved` first-refusal hold keeps its unique string but is invisible here, so
 * a payer who resolves it gets exactly what they get for a name that does not
 * exist — a 404, never a name that is held back without saying so.
 *
 * TWO lookups, in order, because a person's username is GLOBAL while a business
 * name is PER NETWORK:
 *
 *  1. the handle on THIS network (all kinds) — unchanged, and it wins, so a
 *     practice merchant's name is never shadowed by a person's;
 *  2. failing that, the GLOBAL person row, wherever it was claimed.
 *
 * (2) is what makes a username work on the network it was not claimed on. Without
 * it every existing username vanishes the moment the deployment serves the other
 * network — `seti.live/u/<name>` 404s and a send-by-username cannot resolve, on the
 * person's OWN name, with no way for them to tell why.
 *
 * And a THIRD, last: a person name released by a RENAME. For `RENAME_HOLD_DAYS`
 * the old string has no `handles` row — it lives in `handle_releases`, held to the
 * account that renamed — and it must still resolve to that account, or every link
 * and printed QR shared before the rename breaks on the day it happened. The hold
 * is invisible to nothing else: a string that some account has CLAIMED always wins
 * over a release row, which is why this is the last lookup and not a parallel one.
 */
export async function findHandleByHandle(handle: string, network: Network = servedNetwork) {
  const scoped = await prisma.handle.findFirst({
    where: { handle: handle.toLowerCase(), reviewStatus: null, network },
    include: HANDLE_PROFILE_SELECT,
  });

  if (scoped) return scoped;

  const globalPerson = await prisma.handle.findFirst({
    where: { handle: handle.toLowerCase(), reviewStatus: null, kind: 'person' },
    include: HANDLE_PROFILE_SELECT,
  });

  if (globalPerson) return globalPerson;

  const hold = await findActiveRenameHold(handle);
  return hold ? toHeldHandleRow(hold, network) : null;
}

/**
 * A handle by the name a customer typed. Last resort, after id and handle.
 *
 * Filtered the same way, for the same reason: a name held for first refusal must
 * not be reachable by typing it. And resolved the same two-step way, for the same
 * reason: a person's username is global, a business's name is this network's.
 */
export async function findHandleByName(name: string, network: Network = servedNetwork) {
  const scoped = await prisma.handle.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, reviewStatus: null, network },
    include: HANDLE_PROFILE_SELECT,
  });

  if (scoped) return scoped;

  return prisma.handle.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, reviewStatus: null, kind: 'person' },
    include: HANDLE_PROFILE_SELECT,
  });
}

/**
 * The handle a platform merchant id belongs to.
 *
 * The id path exists because a QR minted before claims carries `merchant:<id>`
 * rather than a handle. The handle is linked by `merchantId`, so this is a
 * `findFirst` on one indexed column. Filtered like the others: a row held for
 * first refusal carries no merchant profile at all, and this is belt and braces
 * if one ever did.
 *
 * Scoped by network: a `seti.live/u/<handle>` link resolves on the network the
 * deployment serves, so a practice name and a live name are never confused.
 */
export async function findHandleByMerchantId(merchantId: string, network: Network = servedNetwork) {
  return prisma.handle.findFirst({
    where: { merchantId, reviewStatus: null, network },
    include: HANDLE_PROFILE_SELECT,
  });
}
