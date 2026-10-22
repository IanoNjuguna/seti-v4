import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { PLATFORM_FEE_PERCENT } from '@/lib/charges/charge.constants';
import { PAY_COPY, PAY_DIVIDER_CLASS } from './PayPublic.constants';
import type { PayFeeBreakdownProps } from './PayPublic.types';

/**
 * The three lines that make the total, shown BEFORE anything is signed.
 *
 * A fee that appears for the first time on a receipt is a fee the payer did not agree
 * to, so the row is here on every state — paid, expired and refused-by-overpayment
 * alike — and never behind a disclosure. The percentage is printed beside the label
 * rather than next to the figure, because "2%" is the promise and the shilling amount
 * is what it costs today.
 *
 * The total is the only emphasised row: it is the figure the payer actually sends, and
 * the two rows above it are how it was built.
 */
export function PayFeeBreakdown({ currency, amounts, note }: PayFeeBreakdownProps) {
  return (
    <div className="space-y-2">
      <FeeRow label={PAY_COPY.amountRowLabel} value={formatFiat(amounts.amount, currency)} />
      <FeeRow
        label={`${PAY_COPY.feeLabel} (${PLATFORM_FEE_PERCENT}%)`}
        value={formatFiat(amounts.fee, currency)}
      />
      <div className={PAY_DIVIDER_CLASS} />
      <FeeRow label={PAY_COPY.totalRowLabel} value={formatFiat(amounts.total, currency)} strong />

      <Text variant="micro" as="p" className="pt-1">
        {note}
      </Text>
    </div>
  );
}

interface FeeRowProps {
  label: string;
  value: string;
  /** The total: one step heavier, never a different colour. */
  strong?: boolean;
}

/**
 * Label left, figure right, both on one baseline so the column reads as arithmetic.
 *
 * The figure never wraps and never shrinks: a money value broken across two lines
 * ("KES" / "1,250.00") is the one thing this system says a number must never do, and
 * on a 286px column the label is what gives way instead — it is prose, and prose can
 * run onto a second line without changing what it says.
 */
function FeeRow({ label, value, strong = false }: FeeRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Text variant={strong ? 'body-medium' : 'micro'} as="span" className="min-w-0">
        {label}
      </Text>
      <Text
        variant={strong ? 'body-medium' : 'body'}
        as="span"
        tabular
        className="shrink-0 whitespace-nowrap"
      >
        {value}
      </Text>
    </div>
  );
}
