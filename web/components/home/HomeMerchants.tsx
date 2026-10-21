'use client';

import Link from 'next/link';
import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { HOME_PAGE_COPY } from './HomePage.constants';
import type { HomeMerchantsProps } from './HomeMerchants.types';

/**
 * Who the money went to, three rows, in the server's own order.
 *
 * This is what takes the space the chronological list used to hold, and the swap is
 * the point of #94: a ledger row is something you already did, while a merchant is
 * the thing this product knows that a US fintech cannot — a name a wallet signed
 * for, ranked by what was actually spent there. The full ledger is one tap away
 * (`See all`), which is why three is enough here.
 *
 * ABSENT, not empty, when there is nothing to rank: a heading over a hollow list
 * promises a history that does not exist, and an "empty state" would be a second,
 * louder way of saying the account has not paid anyone yet. The page decides
 * (`merchants.length > 0`), so this component never renders itself empty.
 *
 * Each row links to Activity rather than to a merchant page: there is no per-merchant
 * surface (and no search yet), so the honest destination is the ledger the figure
 * came from. The count under the name is what makes a total legible — `KES 8,400.00`
 * from one payment and from nine are different facts.
 */
export function HomeMerchants({ merchants, currency }: HomeMerchantsProps) {
  return (
    <section aria-label={HOME_PAGE_COPY.merchantsTitle} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <Text variant="section" as="h2">
          {HOME_PAGE_COPY.merchantsTitle}
        </Text>
        <Link
          href={HOME_PAGE_COPY.activityHref}
          className="relative rounded-sm text-body-sm font-semibold text-primary after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {HOME_PAGE_COPY.seeAll}
        </Link>
      </div>

      <ul className="[&>li:last-child>*]:border-b-0">
        {merchants.map((merchant) => (
          <li key={merchant.name}>
            <Link
              href={HOME_PAGE_COPY.activityHref}
              className="flex min-h-16 items-center justify-between gap-4 border-b border-hairline-light py-2.5 transition-colors duration-(--duration-quick) ease-out hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <span className="min-w-0">
                <Text variant="card-title" as="span" className="block truncate">
                  {merchant.name}
                </Text>
                <Text variant="micro" as="span" color="secondary">
                  {HOME_PAGE_COPY.paymentCount(merchant.count)}
                </Text>
              </span>
              <Text variant="body-medium" as="span" tabular className="shrink-0 whitespace-nowrap">
                {formatFiat(Number(merchant.total), currency)}
              </Text>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
