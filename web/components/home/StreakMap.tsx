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
 * ## One year, every width
 *
 * Fifty-three columns share whatever width they are given, so the same year is drawn on a laptop at
 * about 11px a square and on a phone at about 5px. It used to be two grids with one hidden by CSS;
 * a slice of the year on a phone meant the screen showed a different span from the one its own tap
 * opens (#391).
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

/**
 * A day still to come: an outline, at every size (#391).
 *
 * A square that EXISTS and has not been lived. It cannot be a fill, because a fill is what a quiet
 * day already is, and it cannot be a pad, because a pad is a day outside the window. The outline is
 * the only shape left that says "this day is here, and empty on purpose".
 *
 * A half-strength fill was tried for the phone, where a square is about five pixels and a one-pixel
 * ring is a fifth of it. It failed for the reason above: 50% of the quiet day's grey, at five pixels,
 * is the quiet day. The ring stays at every size, and the legend swatch carries the same classes so
 * the reader can pair the two.
 */
const AHEAD_CLASSES = 'ring-1 ring-inset ring-hairline-light';

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
            ) : cell.ahead ? (
              /*
               * A day still to come (#389). The map is a full year from the day the account
               * joined, so the right-hand side of it is the future: an outline says "this day
               * exists and has not been lived", which is neither a quiet day (a filled grey one)
               * nor a pad (no square at all).
               */
              <span
                key={cell.date}
                title={`${cell.date}: ${HOME_PAGE_COPY.streakAhead}`}
                className={`aspect-square rounded-[2px] ${AHEAD_CLASSES}`}
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

  /**
   * ONE GRID AT EVERY WIDTH (#391).
   *
   * A phone used to get a twenty-six week slice, because fifty-three columns at a readable cell size
   * do not fit 390px. That was the wrong trade: the whole strip is a link into the year's figures,
   * so the phone was showing a different half-year from the one the tap opens, and a young account
   * saw only the future. The columns are `minmax(0,1fr)` with square cells, so the year simply gets
   * smaller on a phone — about 5px a square — and it is the same year on every screen.
   */
  const hasAhead = columns.some((column) => column.some((cell) => cell.ahead));
  const { activeDays, payments } = streakTotals(daily);

  return (
    <div className="flex flex-col gap-1.5">
      <Grid columns={columns} />

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
          {hasAhead ? (
            <span className="ml-1 flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-[2px] ${AHEAD_CLASSES}`} />
              <Text variant="micro" as="span" color="secondary">
                {HOME_PAGE_COPY.streakAheadLabel}
              </Text>
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
