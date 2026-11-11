'use client';

import { Text } from '@/components/ui';
import { AnalyticsDailyBars } from './AnalyticsDailyBars';
import { ANALYTICS_COPY, DAILY_MARK_FLOOR } from './Analytics.constants';
import type { AnalyticsSeriesBandProps } from './Analytics.types';

/**
 * Band 2 of three (#441): the shape of the window.
 *
 * One heading, one chart. That is the whole band: the counts and ticket sizes that used to sit
 * above the chart in a sentence now live in band 1's three figures, where they are numbers with
 * names instead of prose with zeroes in it.
 *
 * ## The chart is drawn for any window that moved (#534)
 *
 * It used to be refused below fifty payments, and the band printed "Not enough movement in this
 * period to draw a shape" in place of it. For every account in its first months that meant the
 * only picture on the page was missing, and a page of sentences is not a page an owner opens
 * twice. `HomeSummary` already settled this argument for the same data (#381): the map is never
 * hidden, only short. A three-payment week drawn as seven bars, six of them quiet, is a truthful
 * picture of a three-payment week; the busiest day is named in words underneath, so the reader
 * is never asked to infer a trend from four marks.
 *
 * An empty window is the one case with nothing to draw, and band 1 already says so.
 */
export function AnalyticsSeriesBand({ window: selected }: AnalyticsSeriesBandProps) {
  if (selected.count < DAILY_MARK_FLOOR) return null;

  return (
    <section className="flex flex-col gap-2">
      <Text variant="section" as="h2">
        {ANALYTICS_COPY.seriesTitle}
      </Text>

      <AnalyticsDailyBars daily={selected.daily} />
    </section>
  );
}
