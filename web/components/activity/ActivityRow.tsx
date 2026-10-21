import { TransactionRow } from '@/components/ui';
import { ActivityRowAction } from './ActivityRowAction';
import { ActivityRowDetail } from './ActivityRowDetail';
import { retryHref } from './activity.retry';
import type { ActivityRowProps } from './Activity.types';

/**
 * One row in Activity: the shared transaction shape, its indexer detail, and — when
 * the row allows it — the one action it can offer.
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
      details={<ActivityRowDetail transaction={transaction} />}
      action={href ? <ActivityRowAction href={href} merchant={transaction.merchant} /> : undefined}
    />
  );
}
