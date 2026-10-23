import { HANDLE_PATTERN } from './charge.constants';
import type { NamedPayee, PayeeDirectory, PayeeDisplay } from './charge.types';

/**
 * Who is being paid — resolved from the ADDRESS, server-side, on every render.
 *
 * The page is handed an id and nothing else. No handle arrives in the query string,
 * no name is stored in a URL, and no payer can put a name on a page: the address on
 * the charge is the only input, and the directory is the only source of a name. That
 * is the whole anti-forwarding argument — a link someone forwards gets the name the
 * ADDRESS has, not the name the forwarder typed.
 *
 * Three ways this lands, and refusing to guess is what makes them honest:
 *
 *   1. A name whose binding still points at this address → `handle`, carrying the
 *      backend's `verified` answer. Shown as named, and marked verified only when
 *      that answer is yes.
 *   2. A name whose binding now points somewhere ELSE → treated as no name. The
 *      address was repointed after the request was made, so the handle is not a
 *      name for the money this page would send; showing it would label a stranger's
 *      wallet with a name the payer trusts.
 *   3. No name at all, or a name that is not a handle's shape → `address`. The short
 *      address becomes the identity and the page says it has no Seti name, rather
 *      than inventing one from the address's first characters.
 *
 * A directory that FAILS throws, and is never flattened into "no name": a backend
 * that is down must not read to a stranger as "this person has no Seti name". The
 * route's error boundary says something is wrong and offers a retry.
 */
export async function resolvePayee(
  directory: PayeeDirectory,
  address: string
): Promise<PayeeDisplay> {
  const named = await directory.findNamedPayee(address);

  if (!named) return { kind: 'address', address };
  if (!isBoundTo(named, address)) return { kind: 'address', address };
  if (!HANDLE_PATTERN.test(named.handle)) return { kind: 'address', address };

  const name = named.name.trim();
  if (name.length === 0) return { kind: 'address', address };

  return {
    kind: 'handle',
    handle: named.handle,
    name,
    address: named.address,
    verified: named.verified,
    // Carried through, never defaulted: a directory that does not say when the merchant
    // was reviewed must not have its silence read as a review. `null` is the unverified
    // tier, and so is a missing answer (#154).
    merchantVerifiedAt: named.merchantVerifiedAt ?? null,
  };
}

/** The name's own binding, compared against the address the money would go to. */
function isBoundTo(named: NamedPayee, address: string): boolean {
  return named.address.toLowerCase() === address.toLowerCase();
}
