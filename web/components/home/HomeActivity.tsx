'use client';

import Link from 'next/link';
import { Text, TransactionRow } from '@/components/ui';
import { EmptyActivity } from './EmptyActivity';
import type { HomeActivityProps } from './HomeActivity.types';

/**
 * Recent activity: a section header that can be left for the full list, then
 * either the rows or the composed empty state.
 *
 * The rows keep the app's single transaction shape (`TransactionRow`) — merchant
 * mark, name, category, status, amount in tabular figures — so the same
 * component reads correctly here and on `/app/activity`.
 *
 * No margin of its own: the gap between sections belongs to the page that stacks
 * them (`web/app/app/page.tsx`, one scale). The `mt-2` that used to be here was an
 * 8px step that existed nowhere else on the screen, so the gap above this section
 * was 40px while the three above it were 32.
 */
export function HomeActivity({ transactions }: HomeActivityProps) {
  return (
    <section aria-label="Recent activity">
      <div className="flex items-baseline justify-between gap-4">
        <Text variant="section" as="h2">
          Recent activity
        </Text>
        {transactions.length > 0 ? (
          <Link
            href="/app/activity"
            className="rounded-sm text-body-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            See all
          </Link>
        ) : null}
      </div>

      {transactions.length === 0 ? (
        <EmptyActivity />
      ) : (
        <ul className="mt-4 divide-y divide-hairline-light overflow-hidden rounded-md border border-hairline-light">
          {transactions.map((transaction) => (
            <li key={transaction.id}>
              <TransactionRow transaction={transaction} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
