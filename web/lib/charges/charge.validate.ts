import { ADDRESS_PATTERN, CHARGE_ID_PATTERN } from './charge.constants';
import type { StoredCharge } from './charge.types';

/**
 * Parse a stored charge, or refuse it.
 *
 * Everything this page renders is a money claim, so nothing reaches a component
 * until it has been narrowed here: a string amount, a negative amount, an address
 * that is not an address, or a missing id is not something to render carefully —
 * it is something to refuse, and the page has a state for that (`invalid`). The
 * alternative is a page that half-draws a request, which is the "half-truth" the
 * issue forbids.
 *
 * The source hands back `unknown` for exactly this reason: this function IS the
 * type boundary. It returns a `StoredCharge` or null, and never throws — a malformed
 * payload is an answer, not an exception.
 */
export function parseStoredCharge(value: unknown): StoredCharge | null {
  if (!isRecord(value)) return null;

  const {
    id,
    currency,
    amount,
    received,
    recipientAddress,
    memo,
    expiresAt,
    paidAt,
    receiptPath,
    signature,
  } = value;

  if (typeof id !== 'string' || !CHARGE_ID_PATTERN.test(id)) return null;
  if (typeof currency !== 'string' || !CURRENCY_PATTERN.test(currency)) return null;
  if (!isPositiveMoney(amount)) return null;
  if (!isMoney(received)) return null;
  if (typeof recipientAddress !== 'string') return null;
  if (!ADDRESS_PATTERN.test(recipientAddress)) return null;
  if (!isNullableString(memo)) return null;
  if (!isNullableTimestamp(expiresAt)) return null;
  if (!isNullableTimestamp(paidAt)) return null;
  if (!isNullablePath(receiptPath)) return null;
  if (typeof signature !== 'string' || signature.length === 0) return null;

  return {
    id,
    currency,
    amount,
    received,
    recipientAddress,
    memo,
    expiresAt,
    paidAt,
    receiptPath,
    signature,
  };
}

/** `KES`, `USD`, `JPY` — an ISO 4217 code, uppercase, three letters. */
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** A charge for nothing is not a charge: it would print "KES 0.00" and ask for it. */
function isPositiveMoney(value: unknown): value is number {
  return isMoney(value) && value > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * An ISO-8601 instant, or null.
 *
 * `Date.parse` alone accepts a date with no time and reads it in the server's own
 * zone, so a deadline would shift with the deployment's clock settings. A stored
 * timestamp here must name its instant (`Z` or an offset) or it is refused.
 */
function isNullableTimestamp(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

/** A path on this site, never an absolute URL: the receipt lives next door. */
function isNullablePath(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}
