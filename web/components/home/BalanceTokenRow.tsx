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
 *
 * THE ROW REPORTS, IT DOES NOT OFFER (#328). It carried the swap control per row
 * (#240), asking the book what the balance would fetch and printing the answer, with
 * two refusals saying why in a line under it (#304). With the card's way into
 * `/app/swap` gone, so is this: a row is a figure, and the cost it leaves behind is one
 * quote request per non-zero row that is no longer made on mount.
 */
export function BalanceTokenRow({ row, currency }: BalanceTokenRowProps) {
  const { hidden } = useAmountPrivacy();

  // The payload's own string, converted by the one formatter that owns currency
  // decimals. Nothing here re-values the row.
  const value = formatFiat(Number(row.value), currency);

  return (
    <li className="flex flex-col py-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="min-w-0">
          <Text
            variant="micro"
            as="span"
            color={row.zero ? 'inverse-muted' : 'inverse'}
            className="block truncate"
          >
            {row.name}
          </Text>
          {/*
            THE UNITS ARE MASKED TOO (#379). Only the fiat figure on the right went through
            `MaskedAmount`, so an account with the eye closed still printed `0.0045` under the
            token's name: the control hid the total and the value column while the amount itself
            stayed legible on the left. The mask is the same primitive, so the line keeps its
            width and the row does not move when the eye is tapped.
          */}
          <MaskedAmount hidden={hidden} variant="micro" color="inverse-muted">
            <Text variant="micro" as="span" color="inverse-muted" tabular className="block">
              {row.units}
            </Text>
          </MaskedAmount>
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
      </div>
    </li>
  );
}
