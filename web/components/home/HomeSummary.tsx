'use client';

import Link from 'next/link';
import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { StreakMap } from './StreakMap';
import { HOME_PAGE_COPY } from './HomePage.constants';
import type { HomeSummaryProps } from './HomeSummary.types';

/**
 * The last thirty days as a calendar of squares, in one row that leads to the figures
 * behind it (#369).
 *
 * ## What was here before
 *
 * `Last 30 days` over `-KES 486.02 · +KES 96.82`: two totals with no shape. A customer could
 * read how much moved and not whether the week was good, and the figures said nothing about
 * the days between them. The totals are still reconciled server-side and still live on
 * Activity's analytics view, one tap away — this row is now the shape and the tap-through.
 *
 * ## Why the label did not change
 *
 * The period is named from the SERVER's `window.days`, never `This month`: the endpoint
 * returns rolling windows (7 and 30 days), and a rolling 30 days is not a calendar month —
 * printing the word would be a money claim that is wrong in the first and last week of every
 * month, the same class of error as the rounded balance #91 removed.
 *
 * ## No amounts, so nothing to mask
 *
 * The map counts DAYS, not money, so the amount-privacy toggle has nothing to hide here:
 * hiding a figure is a privacy control, and there are no figures left in this row. The
 * reconciled totals it used to print are still on `/app/activity?view=analytics`.
 */
export function HomeSummary({ year }: HomeSummaryProps) {
  return (
    <Link
      href={HOME_PAGE_COPY.summaryHref}
      className="flex flex-col gap-3 pb-1 transition-colors duration-(--duration-quick) ease-out hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="flex items-center justify-between gap-4">
        <Text variant="micro" as="span" color="secondary">
          {HOME_PAGE_COPY.streakLabel}
        </Text>
        <Icon name="chevronRight" className="h-4 w-4 text-ash" />
      </span>

      <StreakMap daily={year.daily} />
    </Link>
  );
}
