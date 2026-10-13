'use client';

import { Button } from '@/components/ui';
import { RECEIPT_COPY } from './Receipt.constants';
import type { ReceiptErrorProps } from './Receipt.types';

/**
 * The receipt's two async states, in one file so they stay a set.
 *
 * The skeleton keeps the card's own shape — a letterhead, the figure, the party,
 * the date, the fee line — so the sheet does not jump when the real receipt
 * lands. It is short on purpose: the card it stands in for is short.
 */
export function ReceiptLoading() {
  return (
    <div aria-busy="true" aria-label={RECEIPT_COPY.loading} className="animate-pulse space-y-3">
      <div className="h-7 w-28 rounded-sm bg-surface-elevated" />
      <div className="h-8 w-44 rounded-sm bg-surface-elevated" />
      <div className="h-4 w-24 rounded-sm bg-surface-elevated" />
      <div className="h-4 w-40 rounded-sm bg-surface-elevated" />
      <div className="h-4 w-full rounded-sm bg-surface-elevated" />
    </div>
  );
}

/**
 * The failure carries the server's own words: "No receipt for that transaction"
 * already says which condition failed, and only the retry is ours to add.
 */
export function ReceiptError({ message, onRetry }: ReceiptErrorProps) {
  return (
    <div role="alert">
      <p className="text-body-md-bold text-on-dark">{RECEIPT_COPY.errorTitle}</p>
      <p className="mt-1 text-body-sm text-on-dark-mute">{message}</p>
      <Button variant="primary" className="mt-4" onClick={onRetry}>
        {RECEIPT_COPY.retry}
      </Button>
    </div>
  );
}
