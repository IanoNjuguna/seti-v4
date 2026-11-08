'use client';

import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { AnalyticsDailyBars } from './AnalyticsDailyBars';
import { ANALYTICS_COPY, DAILY_BAR_FLOOR } from './Analytics.constants';
import type { AnalyticsSeriesBandProps } from './Analytics.types';
import type { AnalyticsWindow } from '@/lib/api/analytics';

/**
 * Band 2 of three (#441): the shape of the window.
 *
 * One heading, one line of figures, one chart. The line is what `What moved` used to be a section
 * about: how many payments each direction carried, and the average and median ticket of each. Those
 * four numbers per half are the answer to "was that typical", and they belong beside the chart rather
 * than above it in a block of their own.
 *
 * Below the floor the chart is not drawn and the line says so. A shape inferred from a handful of
 * payments is a pattern that exists only in the sampling (`DAILY_BAR_FLOOR`, #404), and a page that
 * draws it anyway teaches the reader to trust noise.
 */
export function AnalyticsSeriesBand({ window: selected, currency }: AnalyticsSeriesBandProps) {
  return (
    <section className="flex flex-col gap-2">
      <Text variant="section" as="h2">
        {ANALYTICS_COPY.dailyTitle(selected.days)}
      </Text>

      <Text variant="micro" as="p" color="secondary">
        {seriesLine(selected, currency)}
      </Text>

      {selected.count >= DAILY_BAR_FLOOR ? (
        <AnalyticsDailyBars daily={selected.daily} />
      ) : (
        <Text variant="micro" as="p" color="secondary">
          {ANALYTICS_COPY.seriesBelowFloor}
        </Text>
      )}
    </section>
  );
}

/**
 * The two halves as one line.
 *
 * `in` and `out` are each a count plus two ticket sizes, because a total cannot say whether
 * KES 12,000 was three sales or one, and an average alone is dragged by a single large payment while
 * the median says what the middle one did. Nothing here re-derives a figure: every number is printed
 * from the payload, to the minor unit the server formatted it at.
 */
function seriesLine(selected: AnalyticsWindow, currency: string): string {
  const fiat = (value: string): string => formatFiat(Number(value), currency);

  const received = ANALYTICS_COPY.halfLine(
    ANALYTICS_COPY.splitIn,
    selected.received.count,
    fiat(selected.received.average),
    fiat(selected.received.median)
  );
  const paid = ANALYTICS_COPY.halfLine(
    ANALYTICS_COPY.splitOut,
    selected.paidOut.count,
    fiat(selected.paidOut.average),
    fiat(selected.paidOut.median)
  );

  return `${received} · ${paid}`;
}
