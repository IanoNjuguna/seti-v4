import { formatFiat } from '@/lib/formatCurrency';
import type { FeeQuotePreview } from './FeeQuote.types';

/**
 * The quote table's rows, as data (#99).
 *
 * `FeeQuote` draws these and nothing else, so the four figures a customer decides
 * on have ONE source: the component cannot grow a row the check does not see, and
 * the check cannot pass on a row the screen does not draw. That is the point of the
 * extraction: `check:repeat-send` asserts that the confirmation still carries the
 * platform fee (the leg that goes to the treasury) and the total, on a repeat just
 * as on a first send, and an assertion about a component's JSX is not an assertion
 * about what it renders.
 *
 * The order is the argument: what the person gets, what Seti takes, what the chain
 * takes, what leaves the wallet. The fee is charged on the PRINCIPAL, so the rate is
 * of the principal and never of the total, because quoting it against the total would
 * overstate it, and a customer checking the arithmetic is entitled to find it exact.
 *
 * Gas wears a `≈` only when the server called it an estimate: as a conservative
 * reserve it is a floor, not a figure, and the row should not pretend otherwise.
 */

/** The labels, in one place, so a check can name what it expects without copying. */
export const QUOTE_LABELS = {
  receive: 'They receive',
  /** The rate is appended: `Platform fee (2%)`. */
  fee: 'Platform fee',
  gas: 'Network gas',
  total: 'You send',
} as const;

export type QuoteRowKey = keyof typeof QUOTE_LABELS;

export interface QuoteRow {
  key: QuoteRowKey;
  label: string;
  value: string;
  /** The total is drawn on its own row, louder, under a hairline. */
  total: boolean;
}

/** `2.00` → `2`, `2.50` → `2.5`: a rate is not money, so no trailing zeros. */
export function formatPercent(value: string): string {
  const percent = Number(value);
  return Number.isFinite(percent) ? String(percent) : value;
}

/** The four rows this quote draws, in the order the customer reads them. */
export function quoteRows(preview: FeeQuotePreview): QuoteRow[] {
  const currency = preview.fiatCurrency;
  const approxGas = preview.networkFeeSource === 'estimate' ? '≈ ' : '';

  return [
    {
      key: 'receive',
      label: QUOTE_LABELS.receive,
      value: formatFiat(Number(preview.fiatAmount), currency),
      total: false,
    },
    {
      key: 'fee',
      label: `${QUOTE_LABELS.fee} (${formatPercent(preview.feePercentOfPrincipal)}%)`,
      value: formatFiat(Number(preview.feeFiat), currency),
      total: false,
    },
    {
      key: 'gas',
      label: QUOTE_LABELS.gas,
      value: `${approxGas}${formatFiat(Number(preview.networkFeeFiat), currency)}`,
      total: false,
    },
    {
      key: 'total',
      label: QUOTE_LABELS.total,
      value: formatFiat(Number(preview.totalFiat), currency),
      total: true,
    },
  ];
}
