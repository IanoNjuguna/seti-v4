'use client';

import { Text } from '@/components/ui';
import type { TextVariant } from '@/components/ui/Text.types';
import { ANALYTICS_COPY, windowLabel } from './Analytics.constants';
import type { AnalyticsHeroProps } from './Analytics.types';

/**
 * The one figure the page is about (#441).
 *
 * `net`, not `out`: the server derives it from the two figures printed under it, so a reader who
 * subtracts the segments of the bar lands on this number exactly, and it is the only figure here
 * that is about the account rather than about one direction of it.
 *
 * The size gives way as the figure grows, at the same character thresholds `BalanceFigure` uses, and
 * the figure is pinned to one line: a `net` is a number, and a number that wraps mid-value has
 * stopped being readable. The caption under it says what the difference is OF, because a net with no
 * operands is a number nobody can check.
 */
export function AnalyticsHero({ value, days }: AnalyticsHeroProps) {
  const variant: TextVariant =
    value.length <= 14 ? 'balance' : value.length <= 17 ? 'balance-compact' : 'balance-tight';

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Text variant="micro" as="p" color="secondary">
        {ANALYTICS_COPY.heroLabel}
      </Text>

      <Text variant={variant} as="p" tabular className="whitespace-nowrap">
        {value}
      </Text>

      <Text variant="micro" as="p" color="secondary">
        {ANALYTICS_COPY.heroCaption(windowLabel(days))}
      </Text>
    </div>
  );
}
