'use client';

import { Text } from '@/components/ui';
import { MaskedAmount } from '@/components/ui/MaskedAmount';
import { formatFiat } from '@/lib/formatCurrency';
import { useAmountPrivacy } from '@/lib/privacy/amount-privacy.context';
import { SWAP_TARGET_ASSET } from '@/lib/pay/build-swap';
import { useConvertQuote } from '@/hooks/useConvertQuote';
import { BalanceTokenSwap } from './BalanceTokenSwap';
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
 * THE SWAP ACTION IS ASKED FOR, not drawn blindly (#240). The row asks the book what
 * its whole spendable balance would fetch, and `BalanceTokenSwap` renders nothing at
 * all when the answer is a refusal: the absence IS the book's answer, which is the only
 * honest way to offer a pair whose liquidity comes and goes. A zero row never asks, so
 * an account holding three of four tokens costs one request, not four.
 */
export function BalanceTokenRow({ row, currency, onSwapped }: BalanceTokenRowProps) {
  const { hidden } = useAmountPrivacy();

  // The payload's own string, converted by the one formatter that owns currency
  // decimals. Nothing here re-values the row.
  const value = formatFiat(Number(row.value), currency);

  // The units the row already prints are the trigger, so a balance that changed — after
  // a swap, or a deposit landing — re-asks instead of offering last minute's figure.
  const convert = useConvertQuote({
    assetIn: row.asset,
    assetOut: SWAP_TARGET_ASSET,
    balance: row.zero ? '' : row.units,
  });

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
      </div>

      {/*
        The control is a SIBLING of the row's line, not a column inside it: the confirm
        step carries two figures and two controls, and a money confirm squeezed into the
        width of an amount would either wrap its label or overflow the card. Under the
        line it has the row's full width, and it still disappears entirely when the book
        has nothing to offer — the row then ends on its answer.
      */}
      <BalanceTokenSwap
        offer={convert.status === 'ready' ? convert.quote : null}
        onSwapped={onSwapped}
      />
    </li>
  );
}
