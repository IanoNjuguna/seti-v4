'use client';

import { Text } from '@/components/ui';
import { qualifierSentence } from './Analytics.constants';
import type { AnalyticsQualifierProps } from './Analytics.types';

/**
 * Whether the figures above can be trusted, as ONE sentence (#441, #534).
 *
 * Consistency and settlement used to be two panels of two rows each, sitting below the chart with
 * the same weight as the money. Neither is a subject: they are the answer to "is this number
 * believable", and the honest weight for that is the one line both Klarna and Neo carry under their
 * hero figure.
 *
 * They are also ranked rather than joined: a movement still pending is a live fact and wins; with
 * nothing pending the page says how regular the trade has been. Two sentences in one paragraph
 * alongside a fee caption, an average-and-median line and two "not enough" notes made five
 * explanations between the figure and the first list.
 *
 * Each half is omitted rather than zeroed when the account has nothing to say: a clean fortnight is
 * not a zero, and a queue of nothing is not `0`.
 */
export function AnalyticsQualifier({ consistency, settlement }: AnalyticsQualifierProps) {
  return (
    <Text variant="micro" as="p" color="secondary">
      {qualifierSentence(consistency, settlement)}
    </Text>
  );
}
