'use client';

import { Text } from '@/components/ui';
import { MaskedAmount } from '@/components/ui/MaskedAmount';
import { formatFiat } from '@/lib/formatCurrency';
import { useAmountPrivacy } from '@/lib/privacy/amount-privacy.context';
import type { BalanceTokenRowProps } from './BalanceTokens.types';

/**
 * One asset's share of the figure: the name, its units, and what they are worth.
 *
 * TWO LINES AND THREE FACTS. The name has to be read as a name (`pathUSD` is a word,
 * not a number) and the units as money, so they cannot share a line without one of
 * them shouting; stacking them puts the word on top and its number under it, which is
 * how a receipt noun is read everywhere else. The value sits on the right of both,
 * where the eye already goes for an amount, on the same edge every money figure on
 * this screen ends at.
 *
 * THE INK IS THE HIERARCHY, and there is nothing else to spend: the system has no
 * coloured fill badge and no tinted row, so a row is either at `on-dark` or one step
 * down at `on-dark-mute`. Non-zero: the name and the money in `on-dark` (the two
 * things a customer came for), the units in `on-dark-mute` (the mechanics). Zero: both
 * at `on-dark-mute`, so the row recedes to a line of record and stays there. Muting
 * rather than hiding is the point of the issue — a row that vanishes is
 * indistinguishable from money that vanished.
 *
 * The value is masked with the figure above it: one eye governs every amount on the
 * card, so a card whose total is hidden and whose rows are not would be the leak the
 * control exists to prevent (`check:amount-privacy`).
 */
export function BalanceTokenRow({ row, currency }: BalanceTokenRowProps) {
  const { hidden } = useAmountPrivacy();

  // The payload's own string, converted by the one formatter that owns currency
  // decimals. Nothing here re-values the row.
  const value = formatFiat(Number(row.value), currency);

  return (
    <li className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="min-w-0">
        <Text
          variant="micro"
          as="span"
          color={row.zero ? 'inverse-muted' : 'inverse'}
          className="block truncate"
        >
          {row.name}
        </Text>
        <Text variant="micro" as="span" color="inverse-muted" tabular className="block">
          {row.units}
        </Text>
      </span>

      <span className="shrink-0">
        <MaskedAmount hidden={hidden} variant="micro" align="end">
          <Text
            variant="micro"
            as="span"
            tabular
            color={row.zero ? 'inverse-muted' : 'inverse'}
            className="whitespace-nowrap"
          >
            {value}
          </Text>
        </MaskedAmount>
      </span>
    </li>
  );
}
