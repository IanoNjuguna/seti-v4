'use client';

import { Text } from '@/components/ui';
import { MaskedAmount } from '@/components/ui/MaskedAmount';
import { TokenMark } from '@/components/ui/TokenMark';
import { formatFiat } from '@/lib/formatCurrency';
import { useAmountPrivacy } from '@/lib/privacy/amount-privacy.context';
import type { BalanceTokenRowProps } from './BalanceTokens.types';

/**
 * One asset's share of the figure: the mark, the name, what it is worth on the right (#383, #533).
 *
 * ## One number, and it is the fiat one
 *
 * The row used to print two: the asset's own units under its name, and the fiat value on the
 * right. Inside the dark hero that was a composition, read as a breakdown of the figure above it.
 * As a section of its own it is a list of what the account holds, and a list wants one number per
 * line — the one the balance is denominated in. The units are still one tap away on `/app/activity`;
 * what is gone is a second column that made four rows read as a table.
 *
 * ## The mark is what stops it reading as a table anyway
 *
 * A list of four names and four figures is a table; the same list with each name's own disc in front
 * of it is a wallet, which is why every wallet in the category draws one. The disc is 40px — the same
 * well `RowMark` reserves on the merchant rows below, so both lists put their title on ONE edge (the
 * 16px jag between a 24px disc and a 40px one is the kind of misalignment that reads as two tables
 * rather than one screen). It is decorative: the name beside it is what is read. An asset whose mark
 * has not been vendored draws nothing and the row keeps its shape.
 *
 * ## The row is a line, not a tile
 *
 * A hairline between rows (`border-b`, dropped on the last one), `py-3`, and no fill: with the card
 * gone there is no second box inside a first, and the rule is the only thing separating the rows. Zero rows keep the same shape as funded ones — a row that vanished is how a customer
 * concludes an asset disappeared — and they recede by colour alone.
 *
 * ## The value is masked with the figure above it
 *
 * One eye governs every amount on the screen, so a list whose total is hidden and whose rows are
 * not would be the leak the control exists to prevent (`check:amount-privacy`).
 */
export function BalanceTokenRow({ row, currency }: BalanceTokenRowProps) {
  const { hidden } = useAmountPrivacy();

  // The payload's own string, converted by the one formatter that owns currency decimals.
  // Nothing here re-values the row.
  const value = formatFiat(Number(row.value), currency);

  return (
    <li className="flex min-h-16 items-center gap-3 border-b border-hairline-light py-2.5 last:border-b-0">
      <TokenMark asset={row.asset} size="lg" />

      <Text
        variant="body-medium"
        as="span"
        color={row.zero ? 'secondary' : 'primary'}
        className="min-w-0 flex-1 truncate"
      >
        {row.name}
      </Text>

      <span className="shrink-0">
        <MaskedAmount hidden={hidden} variant="body-medium" align="end" color={row.zero ? 'secondary' : 'primary'}>
          <Text
            variant="body-medium"
            as="span"
            tabular
            color={row.zero ? 'secondary' : 'primary'}
            className="whitespace-nowrap"
          >
            {value}
          </Text>
        </MaskedAmount>
      </span>
    </li>
  );
}
