import { Button, Skeleton, StateMessage } from '@/components/ui';
import { ACTIVITY_COPY } from './Activity.constants';

/**
 * The screen's three async states, in one file so they stay a set.
 *
 * The skeleton matches the layout it stands in for — a day heading plus rows —
 * because a spinner in the middle of an empty page says nothing about what is
 * coming, and the layout then jumps when the rows arrive.
 */
export function ActivityLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label={ACTIVITY_COPY.loading}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function ActivityEmpty() {
  return <StateMessage title={ACTIVITY_COPY.emptyTitle} body={ACTIVITY_COPY.emptyBody} />;
}

/**
 * The failure carries the server's own words and one way out. "Something went
 * wrong" sends people hunting for the wrong bug; the message is already specific.
 */
export function ActivityError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <StateMessage
      tone="alert"
      title={ACTIVITY_COPY.errorTitle}
      body={message}
      action={<Button onClick={onRetry}>{ACTIVITY_COPY.retry}</Button>}
    />
  );
}
