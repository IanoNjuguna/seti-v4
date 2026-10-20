import type { AssetBalanceRow } from '@/lib/api/home.types';

/**
 * Splitting the headline figure across the assets that make it up.
 *
 * The dashboard gives one fiat total and a list of asset amounts, deliberately
 * without a per-row value (see the balance read: four converted figures would be four
 * chances to disagree). A breakdown that shows "OUSD 4,200.00" next to a KES headline
 * is two different units with no visible relationship, so the rows need a value.
 *
 * This derives it instead of asking for it, which has one useful property: the rows
 * are allocated from the SAME total the card shows, so they cannot fail to add up. The
 * alternative, converting each row at the rate, drifts by a cent or two through
 * rounding and produces a breakdown that visibly does not sum to the number above it.
 *
 * Two rules, both structural:
 *  - the split is proportional to the amounts, because every supported asset is 1:1 USD;
 *  - the last cent of rounding drift is absorbed by the LARGEST row, so a cent can only
 *    ever land on the row where it is invisible, never on a row someone is reading.
 */
export interface AssetShare extends AssetBalanceRow {
  /** The share of the headline, two decimals, no currency of its own. */
  fiat: string;
}

function toCents(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function allocateFiat(rows: AssetBalanceRow[], total: string): AssetShare[] {
  if (rows.length === 0) return [];

  const totalCents = toCents(total);
  const amounts = rows.map((row) => {
    const parsed = Number(row.amount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  });
  const sum = amounts.reduce((running, amount) => running + amount, 0);

  if (sum === 0 || totalCents === 0) {
    return rows.map((row) => ({ ...row, fiat: '0.00' }));
  }

  const shares = amounts.map((amount) => Math.round((amount / sum) * totalCents));
  const drift = totalCents - shares.reduce((running, share) => running + share, 0);

  const largest = amounts.reduce((best, amount, index) => (amount > amounts[best] ? index : best), 0);
  shares[largest] += drift;

  return rows.map((row, index) => ({ ...row, fiat: (shares[index] / 100).toFixed(2) }));
}
