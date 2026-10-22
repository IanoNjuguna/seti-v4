'use client';

import Link from 'next/link';
import { Text } from '@/components/ui';
import { MaskedAmount } from '@/components/ui/MaskedAmount';
import { useAmountPrivacy } from '@/lib/privacy/amount-privacy.context';
import { HOME_PAGE_COPY } from './HomePage.constants';
import { formatFiat } from '@/lib/formatCurrency';
import type { HomeSummaryProps } from './HomeSummary.types';

/**
 * What the money did over the period, as ONE row that leads to the figures behind it.
 *
 * The label names the period the SERVER computed, from the window's own `days`,
 * rather than saying `This month`. The endpoint returns rolling windows (7 and 30
 * days), and a rolling 30 days is not a calendar month: printing the word would be
 * a money claim that is wrong for the first and last weeks of every month, which is
 * the same class of error as the rounded balance #91 removed. The row says what it
 * measured, and taps through to `/app/activity?view=analytics` where the same
 * figures sit with their windows and their net.
 *
 * The figures are the SERVER's strings, formatted by the same function the panel
 * uses, so the two cannot disagree to the cent. Nothing here is recomputed from the
 * transaction list: that would be a second implementation of a rule the server owns.
 *
 * Two lines, label above figures, because at 360px `KES 269,270,216.43 out ·
 * KES 9,999,999.99 in` cannot share a line with anything. Left-aligned on the same
 * edge as everything above it.
 */
/**
 * `-KES 8,734.25 · +KES 25,900.00` — the same two figures the analytics panel
 * prints, formatted by the same function.
 *
 * That is the whole point of the row: a customer who taps through must find these
 * numbers, to the cent, because both come from one reconciled response.
 *
 * SIGNS RATHER THAN THE WORDS `out`/`in`, and the choice is a measurement: at 360px
 * the content column is 320px, and `KES 8,734.25 out · KES 25,900.00 in` sets to
 * 336px at this size (294px only by dropping to the caption step). `-…· +…` sets to
 * 288px at the intended size, and it is the vocabulary the ledger already uses: every
 * `TransactionRow` prints `-KES 1,250.00` for money out and `+KES 25,900.00` for money
 * in, so a customer has read this shape a hundred times before this row.
 *
 * Ink on both figures rather than the row's green/alert roles: colouring one half of
 * a link reads as two links. The signs carry the direction.
 */
function movementLine(window: HomeSummaryProps['window'], currency: string): string {
  return `-${formatFiat(Number(window.out), currency)} · +${formatFiat(Number(window.in), currency)}`;
}

export function HomeSummary({ window, currency }: HomeSummaryProps) {
  const { hidden } = useAmountPrivacy();

  return (
    <Link
      href={HOME_PAGE_COPY.summaryHref}
      className="flex flex-col gap-1 border-b border-hairline-light pb-3 transition-colors duration-(--duration-quick) ease-out hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Text variant="micro" as="span" color="secondary">
        {HOME_PAGE_COPY.summaryLabel(window.days)}
      </Text>
      <MaskedAmount hidden={hidden} variant="body-medium">
        <Text variant="body-medium" as="span" tabular>
          {movementLine(window, currency)}
        </Text>
      </MaskedAmount>
    </Link>
  );
}
