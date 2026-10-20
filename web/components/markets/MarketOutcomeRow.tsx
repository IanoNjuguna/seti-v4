import { Text } from '@/components/ui';
import { formatProbability, formatSpread } from '@/lib/markets';
import type { MarketOutcomeRowProps } from './markets.types';

/**
 * One outcome inside an event.
 *
 * A row rather than a card: these are alternatives inside one question, and a
 * surface per outcome would suggest they are separate markets.
 *
 * Three decisions worth keeping:
 *
 *  - **The candidate IS the title.** An event like "US-Iran ceasefire through...?"
 *    has twenty outcomes whose questions are all the same sentence with a different
 *    date, so printing the question repeats the event header twenty times and buries
 *    the only thing that changes. When the venue groups by candidate or date, that
 *    is the row's name.
 *  - **One price, not two.** Yes and No sum to 1 on a binary book, so showing both
 *    charges the reader with arithmetic that answers itself. The big figure is Yes
 *    and the label says so.
 *  - **Text is block.** `Text` renders a `<span>`; without this wrapper the title,
 *    the spread and the date ran together on one line.
 */
export function MarketOutcomeRow({ question, candidate, yes, spread }: MarketOutcomeRowProps) {
  return (
    <article className="flex items-start justify-between gap-4 border-b border-hairline-light py-4 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-1">
        <Text variant="body-medium" as="div">
          {candidate ?? question}
        </Text>
        <Text variant="micro" color="secondary" as="div" tabular>
          Spread {formatSpread(spread)}
        </Text>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <Text variant="body-medium" as="div" tabular>
          {formatProbability(yes)}
        </Text>
        <Text variant="micro" color="secondary" as="div">
          Yes
        </Text>
      </div>
    </article>
  );
}
