'use client';

import { Text } from '@/components/ui';
import { AnalyticsFigures } from './AnalyticsFigures';
import { AnalyticsMerchants } from './AnalyticsMerchants';
import { AnalyticsEmpty, AnalyticsError, AnalyticsLoading } from './AnalyticsStates';
import { WindowPicker } from './WindowPicker';
import { skippedNote, windowLabel } from './Analytics.constants';
import { useAnalytics, useAnalyticsWindow } from './useAnalytics';

/**
 * What the account adds up to, inside the second tab.
 *
 * Nothing here is fetched until the tab is opened (`active`), and once it has been
 * opened the data stays, so switching to Transactions and back is instant rather than
 * a second read of the same figures.
 *
 * An empty window is shown as an empty window, not as three zeros: a period with
 * nothing in it is a fact about the period, and zeroes read as a broken read. The
 * `skipped` line is the honest other half — when the server could not read some rows
 * it says so, instead of presenting a total that is quietly short.
 */
export function ActivityAnalytics({ active }: { active: boolean }) {
  const analytics = useAnalytics({ active });
  const { windows, days, setDays, selected } = useAnalyticsWindow(analytics.data);
  const currency = analytics.data?.currency;

  if (!active) return null;

  return (
    <div className="flex flex-col gap-6">
      {analytics.loading ? <AnalyticsLoading /> : null}

      {analytics.error ? <AnalyticsError message={analytics.error} onRetry={analytics.retry} /> : null}

      {selected && currency ? (
        <>
          {windows.length > 1 ? (
            <WindowPicker windows={windows} selected={days} onSelect={setDays} />
          ) : (
            <Text variant="micro" as="p" color="secondary">
              {windowLabel(selected.days)}
            </Text>
          )}

          {selected.count === 0 ? (
            <AnalyticsEmpty />
          ) : (
            <>
              <AnalyticsFigures window={selected} currency={currency} />

              {selected.skipped > 0 ? (
                <Text variant="micro" as="p" color="secondary">
                  {skippedNote(selected.skipped)}
                </Text>
              ) : null}

              <AnalyticsMerchants merchants={selected.merchants} currency={currency} />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
