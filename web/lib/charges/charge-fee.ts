import { currencyDecimals } from '@/lib/formatCurrency';
import { PLATFORM_FEE_PERCENT } from './charge.constants';

/**
 * What a charge costs the payer, in three lines.
 *
 * The fee is the customer's, not the recipient's, and it is ADDED: the payer sends
 * `total`, the recipient is owed `amount`, and Seti's cut is `fee`. That is the whole
 * shape of the model as `backend/src/services/fees.ts` implements it — no floor, no
 * cap — so there is no "small payment" branch here to get wrong.
 *
 * Two rules this function exists to keep:
 *
 *   1. **The printed letters add up.** `fee` and `total` are rounded to the
 *      currency's own minor unit BEFORE the total is formed, so a payer who adds the
 *      column on screen gets exactly the figure printed under it. Formatting three
 *      independently-rounded numbers would occasionally be a cent off, which reads
 *      as a hidden charge even when nothing is hidden.
 *   2. **Display only.** Nothing here decides what is transferred. The signed figure
 *      is the charge's, and this is the label on it — restating the fee as a
 *      calculation the page owns would be a second money model, which is exactly
 *      what `fees.ts` exists to prevent.
 */
export interface ChargeAmounts {
  /** The principal — what the recipient is owed. */
  amount: number;
  /** The platform fee, rounded to the currency's minor unit. */
  fee: number;
  /** What the payer sends: `amount + fee`. */
  total: number;
}

export function chargeAmounts(amount: number, currency: string): ChargeAmounts {
  const decimals = currencyDecimals(currency);
  const fee = roundToMinor((amount * PLATFORM_FEE_PERCENT) / 100, decimals);

  return { amount, fee, total: roundToMinor(amount + fee, decimals) };
}

/**
 * Round to the currency's minor unit.
 *
 * The `EPSILON` nudge is the standard one: `0.145 * 100` is `14.499999999999998` in
 * binary floating point, and `Math.round` would drop it to 14 — a fee a cent lower
 * than the percentage says.
 */
function roundToMinor(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor + Number.EPSILON) / factor;
}
