import { Button, StateMessage } from '@/components/ui';
import { EmptyActivity } from '@/components/home/EmptyActivity';
import { ACTIVITY_COPY } from './Activity.constants';

/**
 * The screen's three async states, in one file so they stay a set.
 *
 * The skeleton matches the layout it stands in for — 64px rows with a 40px mark
 * and the money at the end, separated by the rows' own hairlines — because a
 * spinner in the middle of an empty page says nothing about what is coming, and
 * the layout then jumps when the rows arrive. It used to be three full-bleed
 * `h-16` bars; then a bordered container, which promised a card the list no
 * longer draws (the rows stand on the canvas now — see `ActivityDay`).
 *
 * The empty state is the SAME composed block the home screen renders, imported
 * rather than re-drawn: "no payments yet" is one idea with one voice, and two
 * treatments for it is how the two drift. `StateMessage` is left for the
 * neutral/long-form case it is actually for.
 *
 * The failure carries the server's own words and one way out. "Something went
 * wrong" sends people hunting for the wrong bug; the message is already specific.
 */
export function ActivityLoading() {
  return (
    <div aria-busy="true" aria-label={ACTIVITY_COPY.loading}>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="flex h-16 items-center gap-3 border-b border-hairline-light px-5 last:border-b-0"
        >
          <span className="block h-10 w-10 shrink-0 rounded-full bg-surface-soft" />
          <div className="min-w-0 flex-1">
            <span className="block h-4 w-32 rounded-sm bg-surface-soft" />
            <span className="mt-1 block h-3 w-24 rounded-sm bg-surface-soft" />
          </div>
          <span className="block h-4 w-20 shrink-0 rounded-sm bg-surface-soft" />
        </div>
      ))}
    </div>
  );
}

/** No margin of its own: `ActivityList`'s own `gap-6` is the header-to-content step. */
export function ActivityEmpty() {
  return <EmptyActivity />;
}

export function ActivityError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <StateMessage
      variant="failure"
      padding="sm"
      title={ACTIVITY_COPY.errorTitle}
      body={message}
      action={<Button onClick={onRetry}>{ACTIVITY_COPY.retry}</Button>}
    />
  );
}
