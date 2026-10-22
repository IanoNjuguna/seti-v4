import { currencyDecimals } from '@/lib/formatCurrency';
import type { ChargeStatus, StoredCharge } from './charge.types';

/** The two facts a status is drawn from. */
type StatusFacts = Pick<StoredCharge, 'currency' | 'amount' | 'received' | 'expiresAt'>;

/**
 * What state this charge is in — derived, never stored.
 *
 * Order matters, and the order is the argument:
 *
 *   1. **Money that arrived decides first.** `received` at or above `amount` is paid
 *      (or overpaid); anything between nothing and the amount is partly paid. A
 *      charge that was paid is paid even if its deadline has since passed: a receipt
 *      outlives a request, and calling a paid charge "expired" would tell a payer
 *      their money did not arrive.
 *   2. **Then the clock, and only when nothing has arrived.** An unpaid request past
 *      its deadline is expired — the one state where the page must NOT offer a code,
 *      because scanning it could still be read as "pay this now".
 *
 * Compared in minor units rather than with `===` on floats: `1250.00` and a received
 * total that arrived as `1249.9999999` are not a 0.0000001 shortfall, they are the
 * same shilling, and a page that said "partly paid" there would be unrecoverable in
 * the customer's mind.
 */
export function resolveChargeStatus(charge: StatusFacts, now: Date): ChargeStatus {
  const decimals = currencyDecimals(charge.currency);
  const due = toMinor(charge.amount, decimals);
  const got = toMinor(charge.received, decimals);

  if (got >= due) return got > due ? 'overpaid' : 'paid';
  if (got > 0) return 'underpaid';

  if (charge.expiresAt !== null && Date.parse(charge.expiresAt) <= now.getTime()) {
    return 'expired';
  }

  return 'pending';
}

/** A figure as a whole number of minor units — the unit money is actually counted in. */
function toMinor(value: number, decimals: number): number {
  return Math.round(value * 10 ** decimals);
}
