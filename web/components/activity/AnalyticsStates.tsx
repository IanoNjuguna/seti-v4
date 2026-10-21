import { Button, StateMessage } from '@/components/ui';
import { ANALYTICS_COPY } from './Analytics.constants';

/**
 * The panel's three async states, as one set.
 *
 * The skeleton is three rows of the same height and the same hairline the figures
 * draw, with a label bar on the left and the amount bar on the right — the shape of
 * what is coming, not a spinner in the middle of nothing. That is what stops the
 * panel jumping when the numbers land.
 */
export function AnalyticsLoading() {
  return (
    <div aria-busy="true" aria-label={ANALYTICS_COPY.loading} className="flex flex-col">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="flex h-12 items-center justify-between border-b border-hairline-light last:border-b-0"
        >
          <span className="block h-3 w-20 rounded-sm bg-surface-soft" />
          <span className="block h-4 w-28 rounded-sm bg-surface-soft" />
        </div>
      ))}
    </div>
  );
}

/**
 * An empty window is not an empty account: the customer HAS a history, this period
 * simply has nothing in it. So it says that, and the window switcher stays above it —
 * the fix is often to look at a longer period, and a message that hid the control
 * would be hiding the way out of itself.
 */
export function AnalyticsEmpty() {
  return (
    <StateMessage
      variant="empty"
      padding="sm"
      title={ANALYTICS_COPY.emptyTitle}
      body={ANALYTICS_COPY.emptyBody}
    />
  );
}

export function AnalyticsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <StateMessage
      variant="failure"
      padding="sm"
      title={ANALYTICS_COPY.errorTitle}
      body={message}
      action={<Button onClick={onRetry}>{ANALYTICS_COPY.retry}</Button>}
    />
  );
}
