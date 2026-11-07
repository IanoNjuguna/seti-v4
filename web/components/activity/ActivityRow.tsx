import { TransactionRow } from '@/components/ui';
import { ActivityRowAction } from './ActivityRowAction';
import { retryHref } from './activity.retry';
import type { ActivityRowProps } from './Activity.types';

/**
 * One row in Activity: the shared transaction shape, and — when the row allows it —
 * the one action it can offer.
 *
 * THE CHAIN DETAIL LEFT THE ROW (#407). Time, hash, both ends and the asset sat under every row
 * from `md` up, which made the ledger read as a block explorer: the first thing a person saw about a
 * payment was a 42-character address. That detail is verification material, so it belongs on the
 * receipt — one tap away, on the document a person would show anyone who asked.
 *
 * The decision lives here rather than in `TransactionRow` for the reason every other
 * split in this folder exists: the primitive renders whatever it is handed, and the
 * screen is the only place that knows a failed payment to a named person can be paid
 * again. `retryHref` answers null for everything else, so no other row grows a
 * control, and the primitive never learns what "failed" means.
 */
export function ActivityRow({ transaction, onSelect }: ActivityRowProps) {
  const href = retryHref(transaction);

  return (
    <TransactionRow
      transaction={transaction}
      onSelect={onSelect}
      action={href ? <ActivityRowAction href={href} merchant={transaction.merchant} /> : undefined}
    />
  );
}
