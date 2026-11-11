'use client';

import Link from 'next/link';
import { RowMark, Text } from '@/components/ui';
import { initialOf } from '@/components/ui/transaction-glyph';
import { MaskedAmount } from '@/components/ui/MaskedAmount';
import { formatFiat } from '@/lib/formatCurrency';
import { useAmountPrivacy } from '@/lib/privacy/amount-privacy.context';
import type { AnalyticsMerchant } from '@/lib/api/analytics';
import { formatAddress } from './home.format';
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
  const { hidden } = useAmountPrivacy();

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
              className="flex min-h-16 items-center gap-3 border-b border-hairline-light py-2.5 transition-colors duration-(--duration-quick) ease-out hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              {/*
                THE CIRCLE FOLLOWS #409's RULE, NOT A COPY OF IT. A merchant whose name a wallet
                signed for keeps its initial. A counterparty with no name (`kind: 'address'`) has
                nothing to reduce, and drawing its first character would put a column of `0`s down the
                list — the same letter-column bug #409 fixed on Activity. It wears the outgoing arrow
                instead, which is what every row on this section is.
              */}
              <RowMark
                icon={merchant.kind === 'address' ? 'send' : null}
                initial={initialOf(merchant.name)}
              />
              <span className="min-w-0 flex-1">
                <Text variant="card-title" as="span" className="block truncate">
                  {titleFor(merchant)}
                </Text>
                <Text variant="micro" as="span" color="secondary">
                  {HOME_PAGE_COPY.paymentCount(merchant.count)}
                </Text>
              </span>
              <span className="shrink-0">
                <MaskedAmount hidden={hidden} variant="body-medium" align="end">
                  <Text variant="body-medium" as="span" tabular className="whitespace-nowrap">
                    {formatFiat(Number(merchant.total), currency)}
                  </Text>
                </MaskedAmount>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The row's title: a merchant's own name, or an address shortened to `0xde80…CB6`.
 *
 * An unresolved counterparty's name IS its address, and 42 characters set at card-title weight was
 * the widest, least readable thing on the section: it truncated at 390px and told nobody anything at
 * 1280px. The short form is what every consumer wallet prints, and the full address is where it
 * belongs, on the row in Activity that this one points at.
 *
 * Decided by the payload's own `kind`, never by testing the string: the server already knows which
 * rows are an address standing in for a name (#402), and a regex here would be a second opinion that
 * disagrees the first time a merchant registers a name that looks like hex.
 */
function titleFor(merchant: AnalyticsMerchant): string {
  return merchant.kind === 'address' ? formatAddress(merchant.name) : merchant.name;
}
