import { Button, StateMessage } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { ACTIVITY_COPY } from './Activity.constants';
import { ACTIVITY_SEARCH_COPY } from './ActivitySearch.constants';
import type { ActivityNoMatchesProps } from './ActivitySearch.types';

/**
 * What a query with no matches says.
 *
 * Words, not an empty page: a blank list under a filled field reads as a broken
 * screen, and the customer cannot tell whether the payment is missing or the
 * search is. The message names the query back, offers the one action that always
 * works (clear it), and says plainly whether the search has even seen the whole
 * history — a "nothing matches" that is really "nothing in the twenty rows loaded
 * so far" is a false claim about the customer's money.
 *
 * It reuses the app's empty state rather than a new block, so "nothing here" is
 * one shape everywhere it appears. Clearing from here returns the caret to the
 * field (the shared `clear`), so the next query can be typed without hunting.
 */
export function ActivityNoMatches({ search, canLoadMore, loadingMore, onLoadMore }: ActivityNoMatchesProps) {
  return (
    <StateMessage
      variant="empty"
      icon={<Icon name="search" className="h-5 w-5" />}
      title={ACTIVITY_SEARCH_COPY.noMatches(search.value.trim())}
      body={canLoadMore ? ACTIVITY_SEARCH_COPY.noMatchesMore : ACTIVITY_SEARCH_COPY.noMatchesBody}
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={search.clear}>{ACTIVITY_SEARCH_COPY.clear}</Button>

          {canLoadMore ? (
            <Button variant="ghost" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? ACTIVITY_COPY.loadingMore : ACTIVITY_COPY.loadMore}
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
