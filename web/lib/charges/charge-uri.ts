import { CHARGE_ID_PATTERN, CHARGE_URI_PREFIX } from './charge.constants';

/**
 * The string a charge's QR encodes, and its inverse.
 *
 * Both directions live here, together, because the property that matters is that
 * they agree: `readChargeId(buildChargeUri(id)) === id` for every id the page will
 * accept. Split across the component that draws a code and the scanner that reads
 * one, they drift silently and the code simply stops resolving.
 *
 * There is no amount, address or memo in the string. Those travel with the charge
 * the id names (see `CHARGE_URI_PREFIX`).
 */
export function buildChargeUri(id: string): string {
  return `${CHARGE_URI_PREFIX}${id}`;
}

/**
 * The charge id a `seti://pay/...` string names, or null.
 *
 * Null covers every failure mode at once — another scheme, no id, an id with a path
 * segment smuggled after it — because a caller can do nothing different about them.
 */
export function readChargeId(uri: string): string | null {
  if (!uri.startsWith(CHARGE_URI_PREFIX)) return null;

  const id = uri.slice(CHARGE_URI_PREFIX.length);
  return CHARGE_ID_PATTERN.test(id) ? id : null;
}
