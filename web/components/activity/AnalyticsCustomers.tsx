'use client';

import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsCustomersProps } from './Analytics.types';

/**
 * Who pays this account, and who has stopped (#396).
 *
 * ## A payer is an address, and the screen says so
 *
 * Seti never asks a payer for a name: the money arrives from their wallet, so the only identity the
 * ledger holds is the counterparty address. It is shown shortened, the way the rest of the app shows
 * one, and it is never dressed up as a person. A merchant reads it as "the wallet that keeps coming
 * back", which is exactly what it is.
 *
 * ## Counted over the account's life, not the window
 *
 * The window switcher above changes what the period figures count. This block does not follow it: a
 * customer who paid in March and never again is the person worth naming, and a thirty-day window
 * would have already forgotten them. Mixing the two would make the block silently wrong at 7 days.
 *
 * ## Repeat and lapsed are the two useful cuts
 *
 * `repeat` is how many came back at least once, which is the closest thing this ledger has to
 * loyalty. `lapsed` is the win-back list: no payment in thirty days. Both are counts, not rates: a
 * percentage of three customers is a lie told with decimal places.
 */
export function AnalyticsCustomers({ customers, currency }: AnalyticsCustomersProps) {
  if (customers.count === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <Text variant="micro" as="p" color="secondary">
        {ANALYTICS_COPY.customersLine(customers.count, customers.repeat, customers.lapsed)}
      </Text>

      {customers.top.length > 0 ? (
        <ul className="flex flex-col">
          {customers.top.map((customer) => (
            <li
              key={customer.address}
              className="flex min-h-12 items-center justify-between gap-4 border-b border-hairline-light py-2.5 last:border-b-0"
            >
              <span className="min-w-0">
                <Text variant="body" as="span" tabular className="block truncate">
                  {shortAddress(customer.address)}
                </Text>
                <Text variant="micro" as="span" color="secondary">
                  {ANALYTICS_COPY.customerPayments(customer.count)}
                </Text>
              </span>
              <Text variant="body-medium" as="span" tabular className="shrink-0">
                {formatFiat(Number(customer.total), currency)}
              </Text>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** `0x5e08…7fc5`: enough to recognise a wallet, short enough not to become the whole row. */
function shortAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}
