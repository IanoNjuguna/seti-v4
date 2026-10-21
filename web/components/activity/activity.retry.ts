import type { Transaction } from '@/lib/types';

/**
 * Where a failed row's `Try again` goes — or null, which means no pill at all.
 *
 * The pill exists because a payment the chain reverted is a payment the person
 * probably still wants to make. It can only be drawn when the flow it opens can
 * actually name the same recipient, and that is what `payeeHandle` is for: the row
 * also carries the address, but the ONE resolver takes a QR payload, a handle or a
 * name — never a `0x` string — so a pill built on the address would open a send
 * flow that resolves nobody (see #119).
 *
 * The amount rides along so "again" means the same figure rather than a number the
 * customer has to retype from the row they are looking at. It is the row's own fiat
 * figure, so it is the one they can see, not a USD amount they cannot.
 *
 * Null for everything else, deliberately: a completed row has nothing to try again,
 * a pending one must not be sent twice, and money coming IN is not a send.
 */
export function retryHref(transaction: Transaction): string | null {
  if (transaction.status !== 'failed') return null;
  if (transaction.amount >= 0) return null;

  const payee = transaction.payeeHandle?.trim();
  if (!payee) return null;

  const amount = Math.abs(transaction.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const query = new URLSearchParams({ to: payee, amount: amount.toFixed(2) });
  return `/app/send?${query.toString()}`;
}
