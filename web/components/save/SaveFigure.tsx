'use client';

import { formatFiat } from '@/lib/formatCurrency';
import { Skeleton, Text } from '@/components/ui';
import { SAVE_COPY, cardRateLine } from './Save.constants';
import type { SaveFigureProps } from '@/hooks/useSave.types';

/**
 * The saved figure, and what it is doing.
 *
 * Cash App's hierarchy: the number is the page, everything else is a line under it.
 * Three lines, in the order a customer asks them:
 *
 *  1. what is saved, in their currency;
 *  2. what it earns — the live campaign's rate, whether or not anything is saved yet, and
 *     the vault's own rate (or its unavailability) only over a position;
 *  3. what is left to spend, so "how much can I still use" never needs a second
 *     screen.
 */
export function SaveFigure({ summary, loading }: SaveFigureProps) {
  if (loading) {
    return (
      <div className="rounded-md border border-hairline-light bg-surface-soft p-5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-3 h-9 w-40" />
        <Skeleton className="mt-3 h-4 w-32" />
      </div>
    );
  }

  const currency = summary?.fiatCurrency ?? '';
  const saved = summary?.savedFiat ?? '0.00';
  const available = summary?.spendableFiat ?? '0.00';
  const hasSavings = Number(summary?.shares ?? '0') > 0;
  const rateLine = cardRateLine(summary?.campaign ?? null, summary?.apy ?? null, hasSavings);

  return (
    <div className="rounded-md border border-hairline-light bg-surface-soft px-5 py-5">
      <Text variant="micro" as="p" color="secondary">
        {SAVE_COPY.savedLabel}
      </Text>

      <Text variant="balance" tabular as="p" className="mt-1 block">
        {formatFiat(Number(saved), currency)}
      </Text>

      {/*
        One line under the figure, and a second only when there is nothing saved yet. A live
        campaign leads either way (#581): it is the offer, and hiding it until after the
        deposit asked the customer to decide before seeing the reason. The promise line then
        explains where the money goes, and it is the only line an empty card has when no
        campaign is paying.
      */}
      <div className="mt-2 flex flex-col gap-0.5">
        {rateLine ? (
          /*
           * ONE rate line, tinted (#426): the campaign's rate, who pays it and when it stops.
           * It is the only positive figure on the card, so it wears the success ink the app
           * reserves for money in. The vault's own rate and the earnings sentence came off
           * the card on the owner's instruction: 0.0001% and "not measurable yet" read as
           * two apologies under a number, and the claim block below still says the payer is
           * the campaign and not the vault.
           */
          <Text variant="micro" as="p" color="success">
            {rateLine}
          </Text>
        ) : null}

        {!hasSavings ? (
          <Text variant="micro" as="p" color="secondary">
            {SAVE_COPY.empty}
          </Text>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-hairline-light pt-3">
        <Text variant="micro" color="secondary" as="span">
          {SAVE_COPY.availableLabel}
        </Text>
        <Text variant="micro" tabular as="span">
          {formatFiat(Number(available), currency)}
        </Text>
      </div>
    </div>
  );
}
