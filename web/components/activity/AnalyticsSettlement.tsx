'use client';

import { Text } from '@/components/ui';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsSettlementProps } from './Analytics.types';

/**
 * How the settlement is going (#395).
 *
 * ## Why this is a figure and not a promise
 *
 * Every payment is reconciled against its on-chain receipt before it is recorded, and until now that
 * was said in prose on a receipt rather than shown as a number. A merchant reading "None pending" and
 * "typically 4s" has been told the thing the product is built on, in the only form that can be
 * checked against the next payment.
 *
 * ## Pending is counted, never inferred
 *
 * A row is pending because its status says so, not because a receipt is missing: the absence of a
 * receipt is a different fact, and one this surface would get wrong. The oldest pending movement
 * carries its age, because a queue of one that is four hours old is a different situation from a
 * queue of four that are four seconds old.
 *
 * ## Durations carry their unit
 *
 * `4` is not an answer. The formatter picks seconds, minutes, hours or days from the value, and a
 * movement with no `settledAt` is excluded from the timing rather than counted as instant.
 */
export function AnalyticsSettlement({ settlement }: AnalyticsSettlementProps) {
  return (
    <section aria-labelledby="settlement-heading" className="flex flex-col gap-2">
      <Text variant="section" as="h2">
        <span id="settlement-heading">{ANALYTICS_COPY.settlementTitle}</span>
      </Text>

      <ul className="flex flex-col">
        <Line
          label={ANALYTICS_COPY.pending}
          value={ANALYTICS_COPY.pendingValue(settlement.pending, settlement.oldestPendingHours)}
        />
        <Line
          label={ANALYTICS_COPY.settleTime}
          value={ANALYTICS_COPY.settleTimeValue(
            settlement.settledCount,
            settlement.medianHours,
            settlement.worstHours
          )}
        />
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
