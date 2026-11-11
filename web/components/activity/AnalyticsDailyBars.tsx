'use client';

import { Text } from '@/components/ui';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsDailyBarsProps } from './Analytics.types';

/**
 * Payments a day, across the window (#404).
 *
 * ## The one question the rows cannot answer
 *
 * `What moved` says how much and how often. It cannot say whether this week beat last, because a total
 * has no shape. This is the shape: one bar per day, left to right, oldest to newest.
 *
 * ## No chart library, no axes by default
 *
 * The bars are divs with a height, which is all a bar chart is at thirty values. A library would bring
 * a layout engine, a colour system and a tooltip language this page already has, and the growth would
 * be a second design vocabulary inside one tab.
 *
 * The scale is the busiest day in the window, not a fixed ceiling: a fortnight of fours and a fortnight
 * of forties should both read as shape. The two labels that matter are named in words underneath — the
 * busiest day and its count — so the chart never has to be read by eyeballing pixel heights.
 *
 * The heading and the window are NOT here: band 2 owns them (#441), so this file is only the marks and
 * cannot be dropped somewhere it would claim a title of its own.
 *
 * ## Zero is drawn, not skipped
 *
 * A day with nothing is a two-pixel tick on the baseline, and the space it occupies is the point:
 * a gap in the run of bars is the same information as the quiet day in the streak map, and closing
 * it up would draw a week of trading that did not happen. The tick is `faint`, not
 * `hairline-light` (#534): at two pixels the lightest rule in the system is invisible on white, so
 * a quiet week read as two black slabs floating on nothing until the baseline rule and the darker
 * tick were added.
 */
export function AnalyticsDailyBars({ daily }: AnalyticsDailyBarsProps) {
  if (daily.length === 0) return null;

  const busiest = Math.max(1, ...daily.map((day) => day.count));
  const peak = daily.reduce((best, day) => (day.count > best.count ? day : best), daily[0]);

  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden className="flex h-24 items-end border-b border-hairline-light">
        {daily.map((day) => (
          <span
            key={day.date}
            title={`${day.date} · ${ANALYTICS_COPY.dailyCount(day.count)}`}
            className="flex flex-1 items-end justify-center self-stretch"
          >
            <span
              style={{ height: `${barHeight(day.count, busiest)}%` }}
              className={`w-full max-w-5 rounded-t-sm ${day.count === 0 ? 'bg-faint' : 'bg-ink'}`}
            />
          </span>
        ))}
      </div>

      <p className="flex justify-between text-[10px] leading-none text-ash">
        <span>{ANALYTICS_COPY.dayShort(daily[0].date)}</span>
        <span>{ANALYTICS_COPY.dayShort(daily[daily.length - 1].date)}</span>
      </p>

      <Text variant="micro" as="p" color="secondary">
        {ANALYTICS_COPY.dailyPeak(peak.date, peak.count)}
      </Text>
    </div>
  );
}

/**
 * A bar's height as a percentage of the tallest.
 *
 * A day with a payment never renders shorter than 8%: at thirty days a single payment against a busy
 * day is a sliver, and a sliver is indistinguishable from the zero beside it, which would erase the
 * difference between "quiet" and "closed".
 */
export function barHeight(count: number, busiest: number): number {
  if (count <= 0) return 2;
  return Math.max(8, Math.round((count / busiest) * 100));
}
