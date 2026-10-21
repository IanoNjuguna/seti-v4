'use client';

import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsMerchantsProps } from './Analytics.types';

/**
 * The merchants the money went to, most first.
 *
 * A merchant is a name a wallet signed for, so the row says "Java House" and never a
 * wallet address: the address is a fact about the payment, not about where the money
 * went from the customer's point of view, and it is already on the receipt.
 *
 * The count is phrased as payments rather than as a bare number, because "Java House
 * 5" beside a figure reads as five shillings.
 */
export function AnalyticsMerchants({ merchants, currency }: AnalyticsMerchantsProps) {
  return (
    <section className="border-t border-hairline-light pt-6">
      <Text variant="card-title" as="h2">
        {ANALYTICS_COPY.merchantsTitle}
      </Text>

      {merchants.length === 0 ? (
        <Text variant="micro" as="p" color="secondary" className="mt-2">
          {ANALYTICS_COPY.merchantsEmpty}
        </Text>
      ) : (
        <ul className="mt-2 flex flex-col">
          {merchants.map((merchant) => (
            <li
              key={merchant.name}
              className="flex items-baseline justify-between gap-4 border-b border-hairline-light py-3 last:border-b-0"
            >
              <span className="flex min-w-0 flex-col">
                <Text variant="body" as="span" className="truncate">
                  {merchant.name}
                </Text>
                <Text variant="micro" as="span" color="secondary">
                  {merchant.count === 1 ? '1 payment' : `${merchant.count} payments`}
                </Text>
              </span>
              <Text variant="body" as="span" tabular>
                {formatFiat(Number(merchant.total), currency)}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
