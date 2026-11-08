'use client';

import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { AnalyticsEmpty } from './AnalyticsStates';
import { AnalyticsHero } from './AnalyticsHero';
import { AnalyticsQualifier } from './AnalyticsQualifier';
import { AnalyticsSplitBar } from './AnalyticsSplitBar';
import { WindowPicker } from './WindowPicker';
import { ANALYTICS_COPY, windowLabel } from './Analytics.constants';
import type { AnalyticsSummaryBandProps } from './Analytics.types';

const HEADING_ID = 'analytics-summary-heading';

/**
 * Band 1 of three (#441): the period, the answer, and whether to trust it.
 *
 * The period control lives INSIDE this band and above the hero, because it governs everything from
 * here down. It used to sit above eight peer sections, where it read as a filter over peers rather
 * than as the control on one subject.
 *
 * The heading is `sr-only`: the visible labels in this block already say what it is (`Period`, `Net`,
 * and the caption under the figure), and a heading saying `Summary` on top of them would be the
 * third word for one thing.
 *
 * An empty window keeps the control and says the period is empty. It is a fact about the period, not
 * about the account, and the fix is often a longer window, so hiding the control would hide the way
 * out.
 */
export function AnalyticsSummaryBand({
  window: selected,
  currency,
  windows,
  days,
  onSelect,
  consistency,
  settlement,
}: AnalyticsSummaryBandProps) {
  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-4">
      {windows.length > 1 ? (
        <WindowPicker windows={windows} selected={days} onSelect={onSelect} />
      ) : (
        <Text variant="micro" as="p" color="secondary">
          {windowLabel(days)}
        </Text>
      )}

      <h2 id={HEADING_ID} className="sr-only">
        {ANALYTICS_COPY.summaryHeading}
      </h2>

      {selected.count === 0 ? (
        <AnalyticsEmpty />
      ) : (
        <>
          <AnalyticsHero value={formatFiat(Number(selected.net), currency)} days={days} />
          <AnalyticsSplitBar window={selected} currency={currency} />
          <AnalyticsQualifier consistency={consistency} settlement={settlement} />
        </>
      )}
    </section>
  );
}
