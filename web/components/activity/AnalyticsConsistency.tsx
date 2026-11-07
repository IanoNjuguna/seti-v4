'use client';

import { Text } from '@/components/ui';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsConsistencyProps } from './Analytics.types';

/**
 * How regular the trade is (#393).
 *
 * ## Why this block is not a chart
 *
 * The home screen already draws the year as a grid of squares; repeating it here would be the same
 * picture at a smaller size. What a reader of the tab wants is the answer in words: how many of the
 * last thirty days had a payment, which one was busiest, and how long it has been since the last one.
 *
 * ## The dry spell is the useful number
 *
 * "No payment in 9 days" makes somebody print more stickers. It is stated as a fact, with no colour,
 * no advice, and no exclamation: a reading, not a warning. It reads off the ACCOUNT's last movement
 * rather than the selected window, so switching to seven days cannot turn a quiet fortnight into a
 * clean one.
 *
 * ## Read off the same year as the streak map
 *
 * Both come from `getDailyYear`, so the tab and the home screen cannot disagree about how many days
 * carried a payment.
 */
export function AnalyticsConsistency({ consistency }: AnalyticsConsistencyProps) {
  const { activeDays, bestDay, drySpellDays } = consistency;

  return (
    <section aria-labelledby="consistency-heading" className="flex flex-col gap-2">
      <Text variant="section" as="h2">
        <span id="consistency-heading">{ANALYTICS_COPY.consistencyTitle}</span>
      </Text>

      <ul className="flex flex-col">
        <Line label={ANALYTICS_COPY.activeDays} value={ANALYTICS_COPY.activeDaysValue(activeDays)} />
        {bestDay ? (
          <Line label={ANALYTICS_COPY.bestDay} value={ANALYTICS_COPY.bestDayValue(bestDay.date, bestDay.count)} />
        ) : null}
        {drySpellDays === null ? null : (
          <Line label={ANALYTICS_COPY.drySpell} value={ANALYTICS_COPY.drySpellValue(drySpellDays)} />
        )}
      </ul>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-hairline-light py-3 last:border-b-0">
      <Text variant="micro" as="span" color="secondary">
        {label}
      </Text>
      <Text variant="body" as="span" tabular>
        {value}
      </Text>
    </li>
  );
}
