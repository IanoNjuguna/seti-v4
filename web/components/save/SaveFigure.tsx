'use client';

import { formatFiat } from '@/lib/formatCurrency';
import { Skeleton, Text } from '@/components/ui';
import { SAVE_COPY } from './Save.constants';
import type { SaveFigureProps } from '@/hooks/useSave.types';

/**
 * The saved figure, and what it is doing.
 *
 * Cash App's hierarchy: the number is the page, everything else is a line under it.
 * Three lines, in the order a customer asks them:
 *
 *  1. what is saved, in their currency;
 *  2. what it earns — the rate when the vault publishes one, and an explicit
 *     "unavailable" when it does not, because a savings screen printing 0% is
 *     telling someone their money earns nothing;
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
  const earned = summary?.earnings?.lifetimeFiat ?? null;
  const hasSavings = Number(summary?.shares ?? '0') > 0;

  return (
    <div className="rounded-md border border-hairline-light bg-surface-soft px-5 py-5">
      <Text variant="micro" as="p" color="secondary">
        {SAVE_COPY.savedLabel}
      </Text>

      <Text variant="balance" tabular as="p" className="mt-1 block">
        {formatFiat(Number(saved), currency)}
      </Text>

      {/*
        One line under the figure, not a stack of them. With nothing saved, the
        promise is the line (and a rate nobody is earning yet adds nothing). With
        savings, the rate — or its unavailability — comes first and earnings follow.
      */}
      <div className="mt-2 flex flex-col gap-0.5">
        {!hasSavings ? (
          <Text variant="micro" as="p" color="secondary">
            {SAVE_COPY.empty}
          </Text>
        ) : (
          <>
            <Text variant="micro" as="p" color={summary?.apy ? undefined : 'secondary'}>
              {summary?.apy ?? SAVE_COPY.rateUnavailable}
            </Text>
            <Text variant="micro" as="p" color="secondary">
              {earned === null
                ? SAVE_COPY.earnedUnknown
                : `${SAVE_COPY.earnedLabel}: ${formatFiat(Number(earned), currency)}`}
            </Text>
          </>
        )}
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
