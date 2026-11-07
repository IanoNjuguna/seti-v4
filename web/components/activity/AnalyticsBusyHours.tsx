'use client';

import { Text } from '@/components/ui';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsBusyHoursProps } from './Analytics.types';

/**
 * When the counter is busy (#394): seven weekdays by twenty-four hours.
 *
 * ## The grid is texture, the sentence is the answer
 *
 * A hundred and sixty-eight squares is a shape, not a reading: nobody counts them. The three busiest
 * slots are named underneath in words, from the same counts the grid draws, so the two cannot
 * disagree — and the grid is what makes the named hours believable rather than asserted.
 *
 * ## Hours, in the account's zone
 *
 * The buckets were built server-side in the account's own zone (`User.timeZone`), so 10 means ten in
 * Mombasa whatever the reader's laptop is set to. That is why the axis is labelled only every six
 * hours: the labels are for orientation, and the peaks sentence carries the precision.
 *
 * ## Below the floor it does not render at all
 *
 * `busyHours` is null under fifty inbound payments, and the panel says why in one line rather than
 * drawing a field of dots that reads as a finding. A pattern inferred from twelve payments is noise
 * wearing a chart's clothes.
 */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Four steps, the same green the streak map uses, so a busy hour and a busy day look alike. */
const LEVEL_CLASSES = ['bg-surface-soft', 'bg-accent-light-green/30', 'bg-accent-light-green/55', 'bg-accent-light-green'] as const;

/** The busiest cell sets the top step, so a quiet week still shows its own shape. */
function levelFor(count: number, busiest: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0;
  const share = count / busiest;
  if (share > 0.66) return 3;
  if (share > 0.33) return 2;
  return 1;
}

export function AnalyticsBusyHours({ busyHours }: AnalyticsBusyHoursProps) {
  if (!busyHours) return null;

  const busiest = Math.max(1, ...busyHours.buckets.flat());

  return (
    <section aria-labelledby="busy-heading" className="flex flex-col gap-2">
      <Text variant="section" as="h2">
        <span id="busy-heading">{ANALYTICS_COPY.busyTitle}</span>
      </Text>

      <Text variant="body" as="p" color="secondary">
        {ANALYTICS_COPY.busyPeaks(
          busyHours.peaks.map((peak) => ({
            weekday: WEEKDAYS[peak.weekday] ?? '',
            fromHour: peak.fromHour,
            toHour: peak.toHour,
          }))
        )}
      </Text>

      <div aria-hidden className="flex flex-col gap-1">
        <div className="flex gap-1 pl-9">
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className="flex-1 text-[10px] leading-none text-ash">
              {hour % 6 === 0 ? String(hour).padStart(2, '0') : ''}
            </span>
          ))}
        </div>

        {busyHours.buckets.map((week, weekday) => (
          <div key={WEEKDAYS[weekday]} className="flex items-center gap-1">
            <span className="w-8 shrink-0 text-[10px] leading-none text-ash">
              {WEEKDAYS[weekday]}
            </span>
            {week.map((count, hour) => (
              <span
                key={hour}
                title={`${WEEKDAYS[weekday]} ${String(hour).padStart(2, '0')}:00 · ${ANALYTICS_COPY.busyCount(count)}`}
                className={`aspect-square flex-1 rounded-[2px] ${LEVEL_CLASSES[levelFor(count, busiest)]}`}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
