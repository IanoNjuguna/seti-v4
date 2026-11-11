'use client';

import { Text } from '@/components/ui';
import type { TextVariant } from '@/components/ui/Text.types';
import type { AnalyticsHeroProps } from './Analytics.types';

/**
 * The one figure the page is about (#441), whichever direction moved (#534).
 *
 * The label is a prop, not the word `Net`, because the figure is not always the same one.
 * Money in when anything came in; money out when nothing did. A fixed label forces a `net`,
 * and a `net` is the only figure on this page that can be negative, so the largest thing on
 * the page was a minus sign on an ordinary week of paying merchants.
 *
 * The size gives way as the figure grows, at the same character thresholds `BalanceFigure`
 * uses, and the figure is pinned to one line: a payment total is a number, and a number that
 * wraps mid-value has stopped being readable. The caption says how many payments the figure is
 * made of and over what period, so the headline is checkable against the list below it.
 */
export function AnalyticsHero({ label, value, caption }: AnalyticsHeroProps) {
  const variant: TextVariant =
    value.length <= 14 ? 'balance' : value.length <= 17 ? 'balance-compact' : 'balance-tight';

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Text variant="micro" as="p" color="secondary">
        {label}
      </Text>

      <Text variant={variant} as="p" tabular className="whitespace-nowrap">
        {value}
      </Text>

      <Text variant="micro" as="p" color="secondary">
        {caption}
      </Text>
    </div>
  );
}
