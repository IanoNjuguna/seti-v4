'use client';

import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsHalvesProps } from './Analytics.types';

/**
 * The window read as two halves, with the ticket sizes of each (#396).
 *
 * ## Why not another row of totals
 *
 * `Money in` and `Money out` already exist above and answer "how much". They cannot answer "how
 * many times, and how big was a typical one": KES 12,000 could be three sales or one. So each half
 * is a row with its count and its two ticket sizes underneath, in the same right-aligned column the
 * other figures use.
 *
 * ## Why the median is here as well as the average
 *
 * One large payment drags an average away from what a typical customer spends, and the average is
 * the number a merchant will otherwise price against. The median says what the middle customer did.
 * Both come from the server, printed to the minor unit, and nothing here re-derives either.
 *
 * ## The fee is its own row
 *
 * The customer funds it inside their own transfer, so it never leaves the merchant's wallet, but it
 * was previously invisible inside `Money out` beside withdrawals. A merchant looking at what the
 * product costs them should see the number the product actually charged.
 */
export function AnalyticsHalves({ window, currency }: AnalyticsHalvesProps) {
  const fiat = (value: string) => formatFiat(Number(value), currency);

  return (
    <section aria-labelledby="halves-heading" className="flex flex-col gap-2">
      <Text variant="section" as="h2">
        <span id="halves-heading">{ANALYTICS_COPY.halvesTitle}</span>
      </Text>

      <ul className="flex flex-col">
        <HalfRow
          label={ANALYTICS_COPY.received}
          value={fiat(window.received.total)}
          detail={ANALYTICS_COPY.ticket(window.received.count, fiat(window.received.average), fiat(window.received.median))}
        />
        <HalfRow
          label={ANALYTICS_COPY.spent}
          value={fiat(window.paidOut.total)}
          detail={ANALYTICS_COPY.ticket(window.paidOut.count, fiat(window.paidOut.average), fiat(window.paidOut.median))}
        />
        <HalfRow
          label={ANALYTICS_COPY.fee}
          value={fiat(window.paidOut.fee)}
          detail={ANALYTICS_COPY.feeNote}
        />
      </ul>
    </section>
  );
}

interface HalfRowProps {
  label: string;
  value: string;
  detail: string;
}

function HalfRow({ label, value, detail }: HalfRowProps) {
  return (
    <li className="flex flex-col gap-1 border-b border-hairline-light py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4">
        <Text variant="micro" as="span" color="secondary">
          {label}
        </Text>
        <Text variant="body-medium" as="span" tabular>
          {value}
        </Text>
      </div>
      <Text variant="micro" as="span" color="secondary">
        {detail}
      </Text>
    </li>
  );
}
