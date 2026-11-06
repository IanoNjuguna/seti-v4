'use client';

import Link from 'next/link';
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
      className="group flex flex-col gap-3 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="flex items-center justify-between gap-4">
        {/*
          HOVER IS ON THE AFFORDANCE, NOT THE ROW (#373). The row used to fill with
          `surface-soft` on hover, which is the same token the map's quiet days use: pointing at
          the row repainted every empty square in the colour of the hover and the year appeared to
          empty out. A fill would also tint the greens whatever colour it was — and the only two
          colours that read as a different hover here, brick and cyan, already mean "error" and
          "in flight" in this system, so borrowing either would say something untrue about the row.
        */}
        <span className="text-body-sm text-ash underline-offset-4 transition-colors duration-(--duration-quick) ease-out group-hover:text-ink group-hover:underline">
          {HOME_PAGE_COPY.streakLabel}
        </span>
        <Icon
          name="chevronRight"
          className="h-4 w-4 text-ash transition-colors duration-(--duration-quick) ease-out group-hover:text-ink"
        />
      </span>

      <StreakMap daily={year.daily} />
    </Link>
  );
}
