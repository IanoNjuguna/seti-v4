'use client';

import { formatFiat } from '@/lib/formatCurrency';
import { Button, ButtonLink, Text } from '@/components/ui';
import { CONVERT_COPY, convertSymbol, formatToken } from './Convert.constants';
import type { ConvertResultProps } from './Convert.types';

/**
 * What the convert did, once the server has the receipt.
 *
 * It states the ARRIVAL, in the token the customer now holds and in their own
 * currency, because that is the question the page was there to answer. The hash is
 * not shown as a number to read: `Activity` is where a movement is looked up, and a
 * 66-character string on a phone is a wall, not information. It rides on the
 * receipt, which is what the link goes to.
 *
 * `Convert again` returns to the same page with the amount cleared rather than
 * sending the customer home: converting twice in a row is the ordinary case for
 * someone moving money between two stablecoins.
 */
export function ConvertResult({ result, onAgain }: ConvertResultProps) {
  const symbol = convertSymbol(result.assetOut);

  const arrived = formatFiat(Number(result.fiatAmountOut), result.fiatCurrency);

  return (
    <div className="flex flex-col gap-4">
      <Text variant="heading-md" as="h2">
        {CONVERT_COPY.doneTitle}
      </Text>

      <div className="rounded-md border border-hairline-light bg-surface-soft px-4 py-6">
        <Text variant="balance" tabular as="p" className="block">
          {formatToken(result.amountOut)}
        </Text>
        <Text variant="micro" color="secondary" as="p" className="mt-1">
          {symbol} · {arrived}
        </Text>
      </div>

      <Text variant="body" as="p">
        {CONVERT_COPY.doneBodyTemplate
          .replace('{amount}', formatToken(result.amountOut))
          .replace('{symbol}', symbol)}
      </Text>

      <div className="flex flex-col gap-2">
        <Button type="button" fullWidth onClick={onAgain}>
          {CONVERT_COPY.again}
        </Button>
        <ButtonLink href="/app/activity" variant="secondary" fullWidth>
          {CONVERT_COPY.viewActivity}
        </ButtonLink>
      </div>
    </div>
  );
}
