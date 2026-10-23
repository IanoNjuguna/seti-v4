'use client';

import { Button } from '@/components/ui';
import { ActivityBand } from './ActivityBand';
import { ActivityNoMatches } from './ActivityNoMatches';
import { ActivitySearchField } from './ActivitySearchField';
import { ActivityEmpty, ActivityError, ActivityLoading } from './ActivityStates';
import { ACTIVITY_COPY } from './Activity.constants';
import { useActivity } from './useActivity';
import type { ActivityListProps } from './Activity.types';

/**
 * The full history: the search field, then the bands and the day groups inside them.
 *
 * Every state the page can be in is rendered from the hook's own flags rather than
 * guessed in JSX: a failed first page shows the error and a retry, an empty account
 * says so, a page still arriving shows the shape of what is coming, and a query
 * that matches nothing says so in words rather than leaving a blank page under a
 * filled field.
 *
 * The statement row is not here: it acts on the whole account rather than on a page
 * of it, so it lives in the header above both views (`StatementRow`).
 *
 * The search field sits above the bands because it narrows the whole ledger, not a
 * page of it, and it stays put while the results change under it: the control a
 * customer is typing into must not move as they type. Results keep the bands
 * instead of flattening into one list, because a month heading and a day heading are
 * what tell three payments to the same shop apart, and a band with no matches is
 * dropped so that what is on screen is only ever the matches.
 *
 * "Load more" is a button rather than an infinite scroll, and it stays available
 * while a query is active: the search covers the pages already loaded, and the
 * no-match message says so rather than claiming the whole history was searched.
 */
export function ActivityList({ onSelect }: ActivityListProps) {
  const activity = useActivity();

  return (
    <div className="flex flex-col gap-6">
      <ActivitySearchField search={activity.search} />

      {activity.loading ? <ActivityLoading /> : null}

      {activity.error ? <ActivityError message={activity.error} onRetry={activity.retry} /> : null}

      {activity.empty ? <ActivityEmpty /> : null}

      {activity.noMatches ? (
        <ActivityNoMatches
          search={activity.search}
          canLoadMore={activity.hasMore}
          loadingMore={activity.loadingMore}
          onLoadMore={activity.loadMore}
        />
      ) : null}

      {activity.bands?.map((band) => (
        <ActivityBand key={band.key} band={band} onSelect={onSelect} />
      ))}

      {activity.hasMore && !activity.error && !activity.noMatches ? (
        <Button variant="ghost" onClick={activity.loadMore} disabled={activity.loadingMore}>
          {activity.loadingMore ? ACTIVITY_COPY.loadingMore : ACTIVITY_COPY.loadMore}
        </Button>
      ) : null}
    </div>
  );
}
