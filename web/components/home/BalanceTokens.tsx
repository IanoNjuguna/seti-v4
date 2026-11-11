'use client';

import { Text } from '@/components/ui';
import { BalanceTokenRow } from './BalanceTokenRow';
import { BALANCE_TOKENS_COPY } from './BalanceTokens.constants';
import { useBalanceTokens } from './useBalanceTokens';
import type { BalanceTokensProps } from './BalanceTokens.types';

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
 * ZEROS ARE ROWS, IN A FUNDED ACCOUNT (#533). The payload carries one row per asset the
 * NETWORK lists, so a token this account holds none of is a row printing zero, one step
 * quieter (`BalanceTokenRow`) — never a filtered-out line. A customer who cannot see a token
 * cannot tell "I hold none of it" from "it disappeared", and the second is what they conclude.
 *
 * NO SECTION WHEN THERE IS NOTHING TO SHOW (#533). That rule is about a token you held and no
 * longer do, and it only means something where the account holds SOMETHING: the zeros read as
 * "not here, not gone" beside a figure that is not zero. An account holding nothing got a
 * `Tokens` heading and four rows of `KES 0.00` directly under the starter card, which is an empty
 * shelf, not a balance — there is no token to have vanished. So the whole section is absent when
 * every row is zero, and the balance card above already says the one true thing.
 *
 * ABSENT, NOT EMPTY, when there is nothing to list: no rows or no currency means the
 * payload did not say, and the card falls back to the single figure it showed before.
 * A heading over zero rows, or four rows of `KES 0.00` invented for a read that failed,
 * would both be claims nobody made.
 *
 * NO CONTROL ON THIS CARD (#328). Swap sat on the caption's line (#304) and again on
 * every row (#240), on the argument that it acts on all four rows below it and belongs
 * beside the figure it moves. That argument is answered rather than deleted: the card's
 * one job is how much you hold, and a control inside it makes the figure a toolbar. Swap
 * is now a tile in `HomeActions`, with every other door, so `/app/swap` has exactly one
 * way in and this surface has none. The rows lost what the control carried with it: the
 * quote each row asked for on mount, and the sentence two refusals printed under it.
 *
 * The hairline is `hairline-dark`, the system's own divider inside a dark region: it
 * separates the total from its parts without drawing a second surface inside the card.
 */
export function BalanceTokens({ assets, currency }: BalanceTokensProps) {
  const rows = useBalanceTokens(assets);

  if (rows.length === 0 || !currency) return null;
  // An account holding nothing has no parts to show: the heading and its zeros would be a shelf.
  if (rows.every((row) => row.zero)) return null;

  return (
    <section aria-labelledby="tokens-heading" className="flex flex-col gap-2">
      <Text variant="section" as="h2">
        <span id="tokens-heading">{BALANCE_TOKENS_COPY.label}</span>
      </Text>

      {/*
        On the canvas, not in a card (#385). A list is drawn the way every other list on this app
        is: rows on the page's own surface, a hairline between them, none on the last.
      */}
      <ul className="flex flex-col">
        {rows.map((row) => (
          <BalanceTokenRow key={row.asset} row={row} currency={currency} />
        ))}
      </ul>
    </section>
  );
}
