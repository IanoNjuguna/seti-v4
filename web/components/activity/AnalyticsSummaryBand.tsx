'use client';

import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { AnalyticsEmpty } from './AnalyticsStates';
import { AnalyticsHero } from './AnalyticsHero';
import { AnalyticsQualifier } from './AnalyticsQualifier';
import { AnalyticsSplitBar } from './AnalyticsSplitBar';
import { AnalyticsTileRow } from './AnalyticsTileRow';
import { WindowPicker } from './WindowPicker';
import { ANALYTICS_COPY, heroDirection, windowLabel } from './Analytics.constants';
import type { AnalyticsSummaryBandProps } from './Analytics.types';

const HEADING_ID = 'analytics-summary-heading';

/**
 * Band 1 of three (#441): the period, the answer, and whether to trust it.
 *
 * The period control lives INSIDE this band and above the hero, because it governs everything from
 * here down. It used to sit above eight peer sections, where it read as a filter over peers rather
 * than as the control on one subject.
 *
 * The heading is `sr-only`: the visible labels in this block already say what it is (`Period`,
 * `Money in`, and the caption under the figure), and a heading saying `Summary` on top of them
 * would be the fourth word for one thing.
 *
 * ## What the band prints, and in what order (#534)
 *
 * 1. the figure the window is about, labelled by the direction that moved
 * 2. one bar, with both directions' amounts at its ends
 * 3. three numbers: payments, typical payment, net
 * 4. one sentence about whether the figures can be trusted
 *
 * Anything that only restates one of those four is not here. The fee caption, the average and
 * median line, the settlement duration and the "not enough movement" note all used to be, and
 * between them they pushed the first list two screens down while saying that the page had
 * nothing in it. The fee line survives inside the bar, and only when there is a fee.
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
  const hero = heroDirection(selected);
  const fiat = (value: string): string => formatFiat(Number(value), currency);

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
          <AnalyticsHero
            label={hero.label}
            value={fiat(hero.value)}
            caption={ANALYTICS_COPY.heroCaption(windowLabel(days))}
          />
          <AnalyticsSplitBar window={selected} currency={currency} />
          <AnalyticsTileRow
            payments={selected.count}
            typical={fiat(selected[hero.half].median)}
            net={fiat(selected.net)}
          />
          <AnalyticsQualifier consistency={consistency} settlement={settlement} />
        </>
      )}
    </section>
  );
}
