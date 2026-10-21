import type { CSSProperties } from 'react';
import { Text, TransactionRow } from '@/components/ui';
import { ActivityRowDetail } from './ActivityRowDetail';
import type { ActivityDayGroupProps } from './Activity.types';

/**
 * One day: a heading, then its rows in the shared row component.
 *
 * The heading is a real heading (`h3`) so a screen reader can navigate the list by
 * day — one level below the band that contains it (`ActivityBand`), never skipping a
 * level. The rows keep the app's single transaction shape — the same component
 * the home list uses, so a transfer reads identically in both places. From `md` up
 * each row also carries the indexer's detail; below it, the row is unchanged.
 *
 * The rows are page-level rows on the canvas, not a card. The day's `<ul>` used to
 * carry `rounded-md border border-hairline-light` around rows that already draw
 * their own hairline — a box around a box, and a radius the rows' square corners
 * did not share. The separators carry the grouping now and the day heading carries
 * the meaning; only the trailing edge is suppressed, because a separator belongs
 * between two rows. The full rationale is in `HomeActivity` (the same call, on
 * the home list).
 *
 * The rows rise 4px and settle, staggered 24ms and capped at six
 * (`app/app/motion.css`): the one thing a ledger list has to communicate is that
 * it is arriving, and that it ends. Because the animation lives on the `<li>` and
 * React keys them by transaction id, appending a page animates only the rows that
 * are new — the ones already read do not replay. Reduced motion makes the rows
 * simply appear.
 */
export function ActivityDay({ group, onSelect }: ActivityDayGroupProps) {
  return (
    <section aria-label={group.label}>
      <Text variant="micro" as="h3">
        {group.label}
      </Text>

      <ul className="mt-2 [&>li:last-child>*]:border-b-0">
        {group.transactions.map((transaction, index) => (
          <li
            key={transaction.id}
            className="row-enter"
            style={{ '--i': index } as CSSProperties}
          >
            <TransactionRow
              transaction={transaction}
              onSelect={onSelect}
              details={<ActivityRowDetail transaction={transaction} />}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
