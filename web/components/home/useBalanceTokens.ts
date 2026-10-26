'use client';

import { useMemo } from 'react';
import type { AssetBalanceRow } from '@/lib/api/home.types';
import { formatAssetUnits } from './home.format';
import type { BalanceTokenRowView } from './BalanceTokens.types';

/**
 * The payload's rows, as the list renders them.
 *
 * A PASS-THROUGH, and that is the whole contract. The rows arrive one per asset the
 * chain lists, largest first, each already valued at the same rate as the total — so
 * nothing here sorts, filters or converts. Sorting would be a second opinion about
 * the same numbers, filtering would hide a zero (the row whose absence reads as
 * vanished money), and converting would be a second fx rate for a figure the server
 * already computed once (#224).
 *
 * `value` stays the payload's own string. The row prints it, the check sums the
 * printed rows and compares them with the printed figure: three ways of looking at
 * one number are only equal if nothing in between touches it.
 */
export function useBalanceTokens(assets: AssetBalanceRow[] | undefined): BalanceTokenRowView[] {
  return useMemo(
    () =>
      (assets ?? []).map((row) => ({
        asset: row.asset,
        // The registry's spelling, never the ledger's lowercase label. The symbol is
        // what a customer recognizes on an exchange or a receipt.
        name: row.symbol?.trim() || row.asset,
        units: formatAssetUnits(row.amount),
        value: row.value,
        zero: Number(row.value) === 0,
      })),
    [assets]
  );
}
