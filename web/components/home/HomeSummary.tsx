'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { windowLabel } from './home.streak';
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
 * ## The map is never hidden, only short
 *
 * It is drawn from the account's first payment to today, so a new merchant gets a narrow strip
 * rather than a year of nothing or, as once shipped, a sentence instead of the grid (#381).
 *
 * ## On the canvas, not in a card
 *
 * It is a row, not a surface (#385). A border here made the streak a fourth object competing with
 * the balance card above it; the map is a picture of the account's activity and the page's own
 * surface is enough to hold it.
 *
 * ## No amounts, so nothing to mask
 *
 * The map counts DAYS, not money, so the amount-privacy toggle has nothing to hide here:
 * hiding a figure is a privacy control, and there are no figures left in this row. The
 * reconciled totals it used to print are still on `/app/activity?view=analytics`.
 */
export function HomeSummary({ year }: HomeSummaryProps) {
  /**
   * No payments yet is a sentence, not a year of pale squares.
   *
   * A grid of nothing is a picture of a year the account did not have, and it is the first thing a
   * new merchant sees on their home screen. The row keeps its tap-through either way.
   */
  const label = windowLabel(year);

  return (
    <Link
      href={HOME_PAGE_COPY.summaryHref}
      className="group flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          {label}
        </span>
        <Icon
          name="chevronRight"
          className="h-4 w-4 text-ash transition-colors duration-(--duration-quick) ease-out group-hover:text-ink"
        />
      </span>

      {/*
        THE MAP IS ALWAYS DRAWN, however short it is (#381).

        An eight-week floor hid the whole feature for a new account, and a home screen without it
        read as cold: a row of text where the one visual thing on the page used to be. A merchant
        three days in now gets one column of squares, which is a truthful picture of a three-day
        account, rather than a sentence standing in for it.
      */}
      {year.days > 0 ? <StreakMap daily={year.daily} /> : null}
    </Link>
  );
}
