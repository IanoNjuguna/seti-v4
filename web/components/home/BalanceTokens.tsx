'use client';

import Link from 'next/link';
import { Text } from '@/components/ui';
import { SWAP_COPY } from '@/lib/pay/convert-swap.constants';
import { BalanceTokenRow } from './BalanceTokenRow';
import { BALANCE_TOKENS_COPY } from './BalanceTokens.constants';
import { SWAP_ACTION_CLASS } from './BalanceTokenSwap.constants';
import { useBalanceTokens } from './useBalanceTokens';
import type { BalanceTokensProps } from './BalanceTokens.types';

/** The page the header's action opens. One literal, read once. */
const SWAP_PAGE_PATH = '/app/swap';

/** The link's name for a screen reader: the action, and what it acts on. */
const SWAP_PAGE_LABEL = `${SWAP_COPY.action} a balance`;

/**
 * What the figure above is made of: one row per asset the chain lists.
 *
 * THIS IS THE ONE SURFACE THAT NAMES A TOKEN, and the exception is deliberate. The
 * house rule is that a screen shows an amount and never a coin, because a customer
 * holding KES 4,800 holds KES 4,800. It holds while the settlement pass turns a bridged
 * deposit into OUSD in the background — then which token holds the money is
 * housekeeping. That pass is gone (#222): a bridged balance now stays bridged until the
 * customer moves it, so provenance is spendable information, and four identical unnamed
 * rows would answer nothing. The names are here to make provenance visible, not to read
 * as four brands.
 *
 * ZEROS ARE ROWS. The payload carries one row per asset the NETWORK lists, so a token
 * this account holds none of is a row printing zero, one step quieter (`BalanceTokenRow`)
 * — never a filtered-out line. A customer who cannot see a token cannot tell "I hold
 * none of it" from "it disappeared", and the second is what they conclude.
 *
 * ABSENT, NOT EMPTY, when there is nothing to list: no rows or no currency means the
 * payload did not say, and the card falls back to the single figure it showed before.
 * A heading over zero rows, or four rows of `KES 0.00` invented for a read that failed,
 * would both be claims nobody made.
 *
 * THE HEADER CARRIES THE WAY IN (#304). `Swap` sits on the caption's line, opposite the
 * words, because it acts on all four rows below it rather than on one: a fifth control
 * inside a row would say this row, and the page it opens begins by asking which balance
 * anyway. It borrows the row action's own recipe (`SWAP_ACTION_CLASS`), which is the
 * card's recipe for an inline control on the dark canvas, so the two read as one control
 * at two places.
 *
 * The hairline is `hairline-dark`, the system's own divider inside a dark region: it
 * separates the total from its parts without drawing a second surface inside the card.
 */
export function BalanceTokens({ assets, currency, onSwapped }: BalanceTokensProps) {
  const rows = useBalanceTokens(assets);

  if (rows.length === 0 || !currency) return null;

  return (
    <div className="mt-6 border-t border-hairline-dark pt-4">
      <div className="flex items-baseline justify-between gap-4">
        <Text variant="micro" as="p" color="inverse-muted">
          {BALANCE_TOKENS_COPY.label}
        </Text>

        <Link href={SWAP_PAGE_PATH} className={SWAP_ACTION_CLASS} aria-label={SWAP_PAGE_LABEL}>
          <Text variant="micro" as="span" color="inverse">
            {SWAP_COPY.action}
          </Text>
        </Link>
      </div>

      <ul className="mt-1 flex flex-col">
        {rows.map((row) => (
          <BalanceTokenRow key={row.asset} row={row} currency={currency} onSwapped={onSwapped} />
        ))}
      </ul>
    </div>
  );
}
