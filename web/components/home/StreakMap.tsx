import { Text } from '@/components/ui';
import { HOME_PAGE_COPY } from './HomePage.constants';
import { levelFor, monthMarks, streakColumns, streakTotals, type StreakCell } from './home.streak';
import type { StreakMapProps } from './StreakMap.types';

/**
 * A year of payments as a contribution graph: one square a day (#371).
 *
 * ## What it replaced, twice
 *
 * First the row printed `-KES 486.02 · +KES 96.82` — two totals with no shape, and nothing about
 * the days between them. Then it plotted thirty days with weeks as rows, which was right for a
 * month and wrong for the space: seven columns of five squares left two thirds of the row empty.
 * A year rotated the other way — a column a week, seven rows for the weekdays — fills the row, and
 * every day of the year has a place in it.
 *
 * ## The year on a laptop, half of it on a phone
 *
 * Fifty-three columns in a 320px card is four-pixel squares: texture, not a calendar. So the phone
 * gets the last twenty-six weeks at twice the cell size and the laptop gets all fifty-three. Both
 * are rendered and CSS hides one — no media-query hook, no state, and the same first frame on the
 * server and in the browser.
 *
 * ## The colours, and why green
 *
 * Five steps: a quiet day is `hairline-light`, then `accent-light-green` at 25, 50, 75 and 100.
 * The quiet day darkened a step (#375): on a white card `surface-soft` (#f4f4f4) was so close to
 * the paper that a year of empty Sundays read as blank space rather than as squares that are
 * there. `hairline-light` is the lightest rule in the system and the only grey between the two.
 * Green is the app's money-in role — the colour a received payment's figure already wears in the
 * stack and the ledger — so the map needs no legend to say what it counts and no new token enters
 * the system. The levels are absolute (1, 2, 3, 4+), never scaled to the busiest day: one busy
 * Saturday must not make every ordinary day look empty.
 *
 * ## What a screen reader gets
 *
 * Both grids are `aria-hidden`. Three hundred squares with a date each is a table nobody asked to
 * hear; the sentence under them carries the same fact in one clause, and the tap-through to the
 * reconciled totals stays the row's action.
 */
const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-hairline-light',
  1: 'bg-accent-light-green/25',
  2: 'bg-accent-light-green/50',
  3: 'bg-accent-light-green/75',
  4: 'bg-accent-light-green',
};

/** How many weeks a phone shows: half a year, at a cell size a thumb could point at. */
const PHONE_WEEKS = 26;

/** One grid of columns, with its month letters above it. */
function Grid({ columns, className }: { columns: StreakCell[][]; className?: string }) {
  const marks = monthMarks(columns);
  /**
   * Columns share the card's width, and none of them exceeds 14px.
   *
   * The cap is what keeps the map the same HEIGHT at every span. Left to `1fr` alone, a
   * three-day account drew one column as wide as the card and seven rows of it were 300px tall.
   * Growing the cap instead (40px) made the same column 290px tall, which is worse than the empty
   * space it was meant to fill. At 14px the strip is always about 100px tall and a young account
   * simply has a narrow strip (#381).
   */
  const track = {
    gridTemplateColumns: `repeat(${columns.length || 1}, minmax(0, 1fr))`,
    maxWidth: `${(columns.length || 1) * 14}px`,
  };

  return (
    <div aria-hidden className={`flex flex-col gap-[3px] ${className ?? ''}`}>
      <div className="grid gap-[2px] sm:gap-[3px]" style={track}>
        {marks.map((mark) => (
          <span
            key={`${mark.column}-${mark.label}`}
            style={{ gridColumnStart: mark.column }}
            className="justify-self-start text-body-sm leading-none text-ash"
          >
            {mark.label}
          </span>
        ))}
      </div>

      <div className="grid grid-flow-col grid-rows-7 gap-[2px] sm:gap-[3px]" style={track}>
        {columns.flatMap((column) =>
          column.map((cell, rowIndex) =>
            cell.count === null ? (
              <span
                key={`pad-${column[0].date ?? rowIndex}-${rowIndex}`}
                className="aspect-square rounded-[2px] opacity-0"
              />
            ) : (
              <span
                key={cell.date}
                title={`${cell.date}: ${HOME_PAGE_COPY.streakDay(cell.count)}`}
                className={`aspect-square rounded-[2px] ${LEVEL_CLASSES[levelFor(cell.count)]}`}
              />
            )
          )
        )}
      </div>
    </div>
  );
}

export function StreakMap({ daily }: StreakMapProps) {
  const columns = streakColumns(daily);
  const phoneColumns = columns.slice(-PHONE_WEEKS);
  const { activeDays, payments } = streakTotals(daily);

  return (
    <div className="flex flex-col gap-1.5">
      <Grid columns={phoneColumns} className="sm:hidden" />
      <Grid columns={columns} className="hidden sm:flex" />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <Text variant="micro" as="span" color="secondary">
          {HOME_PAGE_COPY.streakSummary(payments, activeDays)}
        </Text>
        <span className="flex items-center gap-1 sm:justify-end" aria-hidden>
          <Text variant="micro" as="span" color="secondary">
            {HOME_PAGE_COPY.streakFewer}
          </Text>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span key={level} className={`h-2.5 w-2.5 rounded-[2px] ${LEVEL_CLASSES[level]}`} />
          ))}
          <Text variant="micro" as="span" color="secondary">
            {HOME_PAGE_COPY.streakMore}
          </Text>
        </span>
      </div>
    </div>
  );
}
