'use client';

import { Button } from '@/components/ui';
import { ActivityBand } from './ActivityBand';
import { ActivityEmpty, ActivityError, ActivityLoading } from './ActivityStates';
import { ACTIVITY_COPY } from './Activity.constants';
import { useActivity } from './useActivity';
import type { ActivityListProps } from './Activity.types';

/**
 * The full history: bands, then the day groups inside each.
 *
 * Every state the page can be in is rendered from the hook's own flags rather than
 * guessed in JSX: a failed first page shows the error and a retry, an empty account
 * says so, and a page still arriving shows the shape of what is coming.
 *
 * The statement row comes first, under the title and above the bands: it acts
 * on the whole account rather than on a page of it, so it does not belong inside a
 * band and it is available whether the list is loading, empty or failed. It is its
 * own module (`StatementRow`) because its state — a format being generated — has
 * nothing to do with the list's.
 *
 * "Load more" is a button rather than an infinite scroll: the customer decides when
 * to ask for more, and the control they used stays where they left it.
 */
export function ActivityList({ onSelect }: ActivityListProps) {
  const activity = useActivity();

  return (
    <div className="flex flex-col gap-6">
      {activity.loading ? <ActivityLoading /> : null}

      {activity.error ? <ActivityError message={activity.error} onRetry={activity.retry} /> : null}

      {activity.empty ? <ActivityEmpty /> : null}

      {activity.bands?.map((band) => (
        <ActivityBand key={band.key} band={band} onSelect={onSelect} />
      ))}

      {activity.hasMore && !activity.error ? (
        <Button variant="ghost" onClick={activity.loadMore} disabled={activity.loadingMore}>
          {activity.loadingMore ? ACTIVITY_COPY.loadingMore : ACTIVITY_COPY.loadMore}
        </Button>
      ) : null}
    </div>
  );
}
