'use client';

import { assetName, shortenValue } from '@/components/receipt/receipt.format';
import type { Transaction } from '@/lib/types';

function endsTitle(from?: string | null, to?: string | null): string | undefined {
  if (!from && !to) return undefined;
  return `${from ?? '—'} → ${to ?? '—'}`;
}

/**
 * The indexer's own detail for one row, as aligned columns from `md` up.
 *
 * Time · Transaction · From → To · Asset — the fields a chain explorer shows, so a
 * transfer can be checked against the chain without leaving the app. It renders
 * inside the row's own content column and is hidden below `md`: a phone has no
 * room for a 42-character address, and the row above it is the one a phone reads.
 * An end the ledger does not know stays an em dash rather than a guess.
 */
export function ActivityRowDetail({ transaction }: { transaction: Transaction }) {
  const { txHash, from, to, asset, date } = transaction;

  return (
    <div className="mt-1.5 hidden grid-cols-[56px_116px_minmax(0,1fr)_72px] items-center gap-3 md:grid">
      <span className="font-tabular text-caption text-stone">
        {date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="truncate font-mono text-caption text-stone" title={txHash ?? undefined}>
        {txHash ? shortenValue(txHash) : '—'}
      </span>
      <span className="truncate font-mono text-caption text-stone" title={endsTitle(from, to)}>
        {from || to ? `${from ? shortenValue(from) : '—'} → ${to ? shortenValue(to) : '—'}` : '—'}
      </span>
      <span className="truncate font-mono text-caption text-stone">
        {asset ? assetName(asset) : '—'}
      </span>
    </div>
  );
}
