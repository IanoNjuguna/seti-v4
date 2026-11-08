'use client';

import { Text } from '@/components/ui';
import { consistencySentence, settlementSentence } from './Analytics.constants';
import type { AnalyticsQualifierProps } from './Analytics.types';

/**
 * Whether the figures above can be trusted, as a sentence (#441).
 *
 * Consistency and settlement used to be two panels of two rows each, sitting below the chart with
 * the same weight as the money. Neither is a subject: they are the answer to "is this number
 * believable", and the honest weight for that is the one line both Klarna and Neo carry under their
 * hero figure.
 *
 * The two sentences are built from the same figures the panels used, so nothing is lost in the
 * demotion, and each is omitted rather than zeroed when the account has nothing to say: a clean
 * fortnight is not a zero, and a queue of nothing is not `0`.
 */
export function AnalyticsQualifier({ consistency, settlement }: AnalyticsQualifierProps) {
  const rhythm = consistencySentence(
    consistency.activeDays,
    consistency.bestDay,
    consistency.drySpellDays
  );
  const trust = settlementSentence(
    settlement.pending,
    settlement.oldestPendingHours,
    settlement.medianHours
  );

  return (
    <Text variant="micro" as="p" color="secondary">
      {`${rhythm} ${trust}`}
    </Text>
  );
}
