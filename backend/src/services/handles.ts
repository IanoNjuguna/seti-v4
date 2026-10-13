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
 * `handle` is unique and indexed, so this is a `findUnique` — NOT a scan that
 * reverse-engineers handles from names. Handles are stored lowercase (the rule
 * lowercases), so a caller's mixed case is lowered to match rather than searched
 * case-insensitively, which would not use the index.
 */
export async function findHandleByHandle(handle: string) {
  return prisma.handle.findUnique({
    where: { handle: handle.toLowerCase() },
    include: HANDLE_PROFILE_SELECT,
  });
}

/** A handle by the name a customer typed. Last resort, after id and handle. */
export async function findHandleByName(name: string) {
  return prisma.handle.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    include: HANDLE_PROFILE_SELECT,
  });
}

/**
 * The handle a platform merchant id belongs to.
 *
 * The id path exists because a QR minted before claims carries `merchant:<id>`
 * rather than a handle. The handle is linked by `merchantId`, so this is a
 * `findFirst` on one indexed column.
 */
export async function findHandleByMerchantId(merchantId: string) {
  return prisma.handle.findFirst({
    where: { merchantId },
    include: HANDLE_PROFILE_SELECT,
  });
}
