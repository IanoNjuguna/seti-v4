import { Button, StateMessage } from '@/components/ui';
import { MARKETS_COPY } from '@/lib/markets';
import type { MarketsFailureProps } from './markets.types';

/**
 * The three async states, in one file so they stay a set.
 *
 * The skeleton repeats the card's own geometry — a label line, two title lines, a
 * progress track — because a spinner says nothing about what is arriving and the
 * grid then jumps when rows land. It is `aria-busy` with a label, so a screen
 * reader hears "loading markets" rather than nothing.
 */
export function MarketsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={MARKETS_COPY.loading}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="flex flex-col gap-4 rounded-md border border-hairline-light p-6">
          <div className="flex justify-between">
            <span className="block h-3 w-16 rounded-sm bg-surface-soft" />
            <span className="block h-3 w-12 rounded-sm bg-surface-soft" />
          </div>
          <span className="block h-4 w-5/6 rounded-sm bg-surface-soft" />
          <span className="block h-4 w-2/3 rounded-sm bg-surface-soft" />
          <div className="flex items-center gap-3">
            <span className="block h-1.5 flex-1 rounded-sm bg-surface-soft" />
            <span className="block h-4 w-10 rounded-sm bg-surface-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MarketsEmpty({ filtered }: { filtered: boolean }) {
  return (
    <StateMessage
      variant="empty"
      title={filtered ? MARKETS_COPY.filteredEmptyTitle : MARKETS_COPY.emptyTitle}
      body={filtered ? MARKETS_COPY.filteredEmptyBody : MARKETS_COPY.emptyBody}
    />
  );
}

/** A failure keeps the venue's own words and offers the one way out. */
export function MarketsFailure({ message, onRetry }: MarketsFailureProps) {
  return (
    <StateMessage
      variant="failure"
      title={MARKETS_COPY.failureTitle}
      body={`${MARKETS_COPY.failureBody} (${message})`}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {MARKETS_COPY.retry}
        </Button>
      }
    />
  );
}
