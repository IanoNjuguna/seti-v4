import { prisma } from '../lib/prisma.js';
import { describeMerchantName, normalizeMerchantName } from '../lib/merchant-name.js';

export interface QrPayload {
  type: 'merchant' | 'unknown';
  /**
   * The merchant handle a QR carries: either the platform id, or — for a
   * merchant who claimed a name — the business name itself, which is the handle
   * the customer was actually given. Both are looked up in the same field; see
   * `resolveMerchant` / `findMerchantByName`.
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

  // A bare token: a platform merchant id, or a merchant's handle. Handles use
  // `[a-z0-9._-]`, so `.` is part of the shape — a handle like `co.op` must reach
  // the handle lookup rather than being read as a name.
  if (/^[a-zA-Z0-9._-]{3,64}$/.test(qrData)) {
    return { type: 'merchant', merchantId: qrData };
  }

  // A business name. Checked after the id shape above, because that shape
  // deliberately excludes spaces: a claimed merchant's handle IS its name, and
  // refusing it here would make a claimed merchant unreachable by QR.
  if (describeMerchantName(qrData) === null) {
    return { type: 'merchant', merchantId: normalizeMerchantName(qrData) };
  }

  return { type: 'unknown' };
}

export async function resolveMerchant(merchantId: string) {
  return prisma.merchant.findUnique({
    where: { id: merchantId },
  });
}

/**
 * A merchant by its stored handle.
 *
 * The handle column is unique and indexed, so this is a `findUnique` on one
 * column — NOT a scan that reverse-engineers handles from names. Handles are
 * stored lowercase (the rule lowercases), so a caller's mixed case is lowered to
 * match rather than searched case-insensitively, which would not use the index.
 */
export async function findMerchantByHandle(handle: string) {
  return prisma.merchant.findUnique({
    where: { handle: handle.toLowerCase() },
  });
}

export async function findMerchantByName(name: string) {
  return prisma.merchant.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
}
