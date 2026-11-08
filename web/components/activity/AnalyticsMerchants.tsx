'use client';

import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsMerchantsProps } from './Analytics.types';

/**
 * The merchants the money went to, most first (#441).
 *
 * A merchant is a name a wallet signed for, so the row says "Java House" and never a wallet address:
 * the address is a fact about the payment, not about where the money went from the customer's point
 * of view, and it is already on the receipt. A payment to a wallet with no name keeps a shortened
 * address, because that is the only identity the ledger holds.
 *
 * The count is phrased as payments rather than as a bare number, because "Java House 5" beside a
 * figure reads as five shillings.
 *
 * The bar behind each row is the row's share of the largest, drawn in the quiet surface so it never
 * competes with the ink: it is the ranking made visible in one glance, without a donut, which this
 * account has no category taxonomy to feed.
 *
 * There is no heading here: band 3's tab label is the heading, and a second one inside the panel was
 * the duplication that came with three sections stacked as peers.
 */
export function AnalyticsMerchants({ merchants, currency }: AnalyticsMerchantsProps) {
  if (merchants.length === 0) {
    return (
      <Text variant="micro" as="p" color="secondary">
        {ANALYTICS_COPY.merchantsEmpty}
      </Text>
    );
  }

  const largest = Math.max(...merchants.map((merchant) => Number(merchant.total)));

  return (
    <ul className="flex flex-col">
      {merchants.map((merchant) => (
        <li
          key={merchant.name}
          className="relative flex min-h-12 items-center justify-between gap-4 border-b border-hairline-light py-2.5 last:border-b-0"
        >
          <span
            aria-hidden
            className="absolute inset-y-1 left-0 rounded-sm bg-surface-soft"
            style={{ width: `${merchantShare(merchant.total, largest)}%` }}
          />

          <span className="relative flex min-w-0 flex-col">
            <Text variant="body" as="span" className="truncate">
              {label(merchant)}
            </Text>
            <Text variant="micro" as="span" color="secondary">
              {ANALYTICS_COPY.customerPayments(merchant.count)}
            </Text>
          </span>

          <Text variant="body-medium" as="span" tabular className="relative shrink-0">
            {formatFiat(Number(merchant.total), currency)}
          </Text>
        </li>
      ))}
    </ul>
  );
}

/** `0x5e08…fc55`: enough to recognise a wallet, short enough not to be the whole row. */
function shortAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function label(merchant: AnalyticsMerchantsProps['merchants'][number]): string {
  return merchant.kind === 'address' ? shortAddress(merchant.name) : merchant.name;
}

/**
 * A row's width as its share of the largest total.
 *
 * A merchant with any spend against it never renders thinner than 4%: at a glance a 1% bar is
 * indistinguishable from a row that drew none, which would read as "this one did not count".
 */
export function merchantShare(total: string, largest: number): number {
  const value = Math.max(0, Number(total) || 0);
  if (largest <= 0 || value === 0) return 0;
  return Math.max(4, Math.round((value / largest) * 100));
}
