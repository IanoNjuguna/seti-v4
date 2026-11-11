'use client';

import { Text } from '@/components/ui';
import { AnalyticsDetailBand } from './AnalyticsDetailBand';
import { AnalyticsSeriesBand } from './AnalyticsSeriesBand';
import { AnalyticsSummaryBand } from './AnalyticsSummaryBand';
import { AnalyticsError, AnalyticsLoading } from './AnalyticsStates';
import { skippedNote } from './Analytics.constants';
import { useAnalytics, useAnalyticsWindow } from './useAnalytics';
import { useTimeZoneSync } from './useTimeZoneSync';

/**
 * What the account adds up to, inside the second tab, in three bands (#441).
 *
 * 1. the period, the figure, and whether to trust it
 * 2. the shape of the period
 * 3. one list slot, three questions
 *
 * It used to be eight sections of near-equal weight inside one window control, which asked the
 * reader to scan all eight and gave none of them primacy.
 *
 * Nothing here is fetched until the tab is opened (`active`), and once it has been opened the data
 * stays, so switching to Transactions and back is instant rather than a second read of the same
 * figures.
 *
 * An empty window keeps band 1 and its control, and draws nothing below it: a period with nothing in
 * it is a fact about the period, and three zeroes would read as a broken read. The `skipped` line is
 * the honest other half: when the server could not read some rows, the page says so instead of
 * presenting a total that is quietly short.
 */
export function ActivityAnalytics({ active }: { active: boolean }) {
  const analytics = useAnalytics({ active });
  const { windows, days, setDays, selected } = useAnalyticsWindow(analytics.data);
  const currency = analytics.data?.currency;
  useTimeZoneSync(analytics.userId, analytics.data?.timeZone);

  if (!active) return null;

  const summary = analytics.data;

  return (
    <div className="flex flex-col gap-8">
      {analytics.loading ? <AnalyticsLoading /> : null}

      {analytics.error ? <AnalyticsError message={analytics.error} onRetry={analytics.retry} /> : null}

      {selected && currency && summary ? (
        <>
          <AnalyticsSummaryBand
            window={selected}
            currency={currency}
            windows={windows}
            days={days}
            onSelect={setDays}
            consistency={summary.consistency}
            settlement={summary.settlement}
          />

          {selected.count > 0 ? (
            <>
              <AnalyticsSeriesBand window={selected} />
              <AnalyticsDetailBand
                window={selected}
                customers={summary.customers}
                currency={currency}
              />
            </>
          ) : null}

          {selected.skipped > 0 ? (
            <Text variant="micro" as="p" color="secondary">
              {skippedNote(selected.skipped)}
            </Text>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
