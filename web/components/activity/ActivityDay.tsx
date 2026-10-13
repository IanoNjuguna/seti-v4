import { Text, TransactionRow } from '@/components/ui';
import { ActivityRowDetail } from './ActivityRowDetail';
import type { ActivityDayGroupProps } from './Activity.types';

/**
 * One day: a heading, then its rows in the shared row component.
 *
 * The heading is a real heading (`h2`) so a screen reader can navigate the list by
 * day, and the rows keep the app's single transaction shape — the same component
 * the home card uses, so a transfer reads identically in both places. From `md` up
 * each row also carries the indexer's detail; below it, the row is unchanged.
 */
export function ActivityDay({ group, onSelect }: ActivityDayGroupProps) {
  return (
    <section aria-label={group.label}>
      <Text variant="micro" as="h2">
        {group.label}
      </Text>

      <ul className="mt-2 divide-y divide-hairline-light overflow-hidden rounded-lg border border-hairline-light">
        {group.transactions.map((transaction) => (
          <li key={transaction.id}>
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
