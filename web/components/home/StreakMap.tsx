import { Text } from '@/components/ui';
import { HOME_PAGE_COPY } from './HomePage.constants';
import { levelFor, streakTotals, streakWeeks } from './home.streak';
import type { StreakMapProps } from './StreakMap.types';

/**
 * The last thirty days as a calendar of squares: the money's year, one day at a time (#369).
 *
 * It replaces the row that printed `-KES 486.02 · +KES 96.82`. That row was two totals and no
 * shape: a customer could read how much moved and not whether the week was good, and the
 * figure told them nothing about the days between the two. The map says both, and the totals
 * still live one tap away on Activity's analytics view, which is where they were reconciled.
 *
 * ## The layout, and where it came from
 *
 * Weekdays across the top, one row per week, from a survey of how this is drawn elsewhere
 * (Cursor's and Gorgias' contribution grids draw weekdays down the side; that shape is wide
 * because it plots a year). Thirty days rotated to seven columns fills a phone's width, and
 * it is the orientation of the month grid the reader already knows.
 *
 * ## The colours, and why green
 *
 * Five steps: an empty day is `surface-soft`, then `accent-light-green` at 25, 50, 75 and
 * 100. Green is the app's money-in role — the same colour a received payment's figure wears
 * in the stack and the ledger — so the map needs no legend to say what it is counting, and
 * no new token enters the system. The levels are absolute (1, 2, 3, 4+), not scaled to the
 * busiest day: a busy Saturday must not make a one-payment Tuesday look empty.
 *
 * ## What a screen reader gets
 *
 * The grid is `aria-hidden`: thirty squares with a date each is a table nobody asked to hear.
 * The sentence above it carries the measurement ("14 payments across 9 days"), which is the
 * same fact in one clause. The tap-through to the figures stays the row's action.
 */
const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-surface-soft',
  1: 'bg-accent-light-green/25',
  2: 'bg-accent-light-green/50',
  3: 'bg-accent-light-green/75',
  4: 'bg-accent-light-green',
};

export function StreakMap({ daily }: StreakMapProps) {
  const weeks = streakWeeks(daily);
  const { activeDays, payments } = streakTotals(daily);

  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden className="flex flex-col gap-1">
        <div className="grid w-fit grid-cols-7 gap-1">
          {HOME_PAGE_COPY.streakWeekdays.map((label, index) => (
            <Text
              key={`${label}-${index}`}
              variant="micro"
              as="span"
              color="secondary"
              className="w-5 text-center"
            >
              {label}
            </Text>
          ))}
        </div>

        {weeks.map((week, index) => (
          <div key={index} className="grid w-fit grid-cols-7 gap-1">
            {week.map((cell, cellIndex) =>
              cell.count === null ? (
                <span key={`pad-${cellIndex}`} className="h-5 w-5 rounded-[4px] opacity-0" />
              ) : (
                <span
                  key={cell.date}
                  title={`${cell.date}: ${HOME_PAGE_COPY.streakDay(cell.count)}`}
                  className={`h-5 w-5 rounded-[4px] ${LEVEL_CLASSES[levelFor(cell.count)]}`}
                />
              )
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <Text variant="micro" as="span" color="secondary">
          {HOME_PAGE_COPY.streakSummary(payments, activeDays)}
        </Text>
        <span className="flex items-center gap-1 sm:justify-end" aria-hidden>
          <Text variant="micro" as="span" color="secondary">
            {HOME_PAGE_COPY.streakFewer}
          </Text>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span key={level} className={`h-2.5 w-2.5 rounded-[3px] ${LEVEL_CLASSES[level]}`} />
          ))}
          <Text variant="micro" as="span" color="secondary">
            {HOME_PAGE_COPY.streakMore}
          </Text>
        </span>
      </div>
    </div>
  );
}
