'use client';

import { formatFiat } from '@/lib/formatCurrency';
import { Text } from '@/components/ui';
import { CONVERT_COPY } from './Convert.constants';
import type { ConvertNoteProps } from './Convert.types';

/**
 * The one line under the pair, and the reason a convert can be read at a glance.
 *
 * Three states, in priority order:
 *
 *  1. A refusal, because it is the only thing on this page a customer must act
 *     on. It is a live region (`role="alert"`) so a screen reader hears the
 *     failure without hunting for it.
 *  2. The quote's own line: the FLOOR and the network fee. The floor is the
 *     promise the signature makes — "at least this much" — so it is stated as a
 *     bound, never as a prediction, and the fee is named because the customer
 *     funds it.
 *  3. The two nothings: pricing, and nothing typed yet.
 *
 * The floor and the fee are one sentence each rather than a key/value list: two
 * figures under two rows of figures is a table, and this page is not a receipt.
 */
export function ConvertNote({ preview, assetOut, quoting, error }: ConvertNoteProps) {
  if (error) {
    return (
      <Text variant="micro" color="alert" as="p" role="alert" className="min-h-5">
        {error}
      </Text>
    );
  }

  if (!preview) {
    return (
      <Text variant="micro" color="secondary" as="p" className="min-h-5">
        {quoting ? CONVERT_COPY.quoting : CONVERT_COPY.empty}
      </Text>
    );
  }

  const fee = CONVERT_COPY.feeTemplate
    .replace('{fee}', formatFiat(Number(preview.networkFeeFiat), preview.fiatCurrency))
    .replace('{currency}', preview.fiatCurrency);

  return (
    <Text variant="micro" color="secondary" as="p" aria-live="polite" className="min-h-5">
      {fee}
    </Text>
  );
}
