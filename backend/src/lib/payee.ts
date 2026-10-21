/**
 * The payee's NAME, as it rides on a ledger row.
 *
 * A transfer's `counterparty` is an address, and an address cannot be resolved
 * back to a name: the ONE resolver (`GET /handles/resolve`) takes a QR payload, a
 * handle or a name — never a `0x` string. So the customer's own resolution (the
 * handle they typed, or the one a `seti.live/u/<handle>` link carried) is written
 * beside the row, and a failed payment can then offer to pay the same person again
 * instead of opening an empty send flow.
 *
 * It is a LABEL, never a decision. Nothing here is trusted to say who was paid —
 * the receipt is, and `recordSend` re-reads both legs before this row exists. The
 * value is stored only when it has the handle's own shape, so a caller cannot
 * smuggle prose into a column the UI renders, and a name typo can never cost a
 * transfer that has already moved: an unusable value is dropped, not refused.
 */

/**
 * The handle namespace, as `normalizeMerchantName` derives it: lowercased,
 * `[a-z0-9._-]`, and `.` is genuinely part of the shape (`co.op` is a handle).
 */
const HANDLE_SHAPE = /^[a-z0-9][a-z0-9._-]{0,62}$/;

/**
 * An EVM address, which the handle shape alone does NOT exclude: 42 lowercase hex
 * characters satisfy `[a-z0-9._-]` perfectly. Caught by the check the first time it
 * ran. It has to be refused here rather than downstream, because a row carrying an
 * address as its "payee name" produces a pill that opens `/app/send?to=0x…` — and
 * the resolver refuses exactly that string, so the customer taps a chip that
 * resolves nobody. The address is already on the row as `to`; the name is the
 * separate thing.
 */
const ADDRESS_SHAPE = /^0x[0-9a-f]{40}$/;

/** A declared name, in the form a handle takes, or null when it is not one. */
export function asHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const candidate = value.trim().toLowerCase();
  if (ADDRESS_SHAPE.test(candidate)) return null;

  return HANDLE_SHAPE.test(candidate) ? candidate : null;
}

/**
 * The row's stored payee name — `metadata.payee.handle` — or null.
 *
 * Reads defensively because `metadata` is untyped Json: a row written before this
 * existed, by another writer, or by a client that sent something else, must read
 * as "no name" rather than as a crash three layers into the list.
 */
export function payeeHandleOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;

  const payee = (metadata as Record<string, unknown>).payee;
  if (!payee || typeof payee !== 'object') return null;

  return asHandle((payee as Record<string, unknown>).handle);
}
