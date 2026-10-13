import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import type { SendFeeSummaryProps } from './SendPanel.types';

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis
          ? 'flex items-baseline justify-between gap-4 border-t border-hairline-dark pt-2'
          : 'flex items-baseline justify-between gap-4'
      }
    >
      <Text variant="micro" as="span" color="inverse-muted">
        {label}
      </Text>
      <Text variant="micro" as="span" color="inverse" tabular>
        {value}
      </Text>
    </div>
  );
}

/** `2.00` → `2`, `2.50` → `2.5`: a rate is not money, so no trailing zeros. */
function formatPercent(value: string): string {
  const percent = Number(value);
  return Number.isFinite(percent) ? String(percent) : value;
}

/**
 * What the send costs, itemised, before anything is signed.
 *
 * Four lines, and the order is the argument: what the person gets, what Seti
 * takes, what the chain takes, what leaves the wallet. The rate comes from the
 * server (`feePercentOfPrincipal`) and is stated as a share of the amount being
 * sent — the fee is charged on the principal, so quoting it against the total
 * would overstate it, and a customer checking the arithmetic is entitled to find
 * it exact.
 *
 * Gas wears a `≈` when it is a live estimate and drops it when the server fell
 * back to its conservative reserve — the figure is real in the first case and a
 * floor in the second, and the panel should not pretend otherwise.
 */
export function SendFeeSummary({ preview, loading }: SendFeeSummaryProps) {
  if (!preview) {
    return loading ? (
      <Text variant="micro" as="p" color="inverse-muted">
        Pricing the transfer…
      </Text>
    ) : null;
  }

  const approxGas = preview.networkFeeSource === 'estimate' ? '≈ ' : '';

  return (
    <div className="space-y-2 rounded-sm bg-canvas-dark p-3">
      <Row
        label="They receive"
        value={formatFiat(Number(preview.fiatAmount), preview.fiatCurrency)}
      />
      <Row
        label={`Platform fee (${formatPercent(preview.feePercentOfPrincipal)}%)`}
        value={formatFiat(Number(preview.feeFiat), preview.fiatCurrency)}
      />
      <Row
        label="Network gas"
        value={`${approxGas}${formatFiat(Number(preview.networkFeeFiat), preview.fiatCurrency)}`}
      />
      <Row
        label="You send"
        value={formatFiat(Number(preview.totalFiat), preview.fiatCurrency)}
        emphasis
      />

      {preview.fxRateStale ? (
        /* Left as a raw line on purpose: this is a caption (13px), and `Text`
           has no `caption` variant — giving it a `micro` base and overriding the
           size by class would trade one class-order fight (colour) for another
           (font-size). It is a warning, not the alert/error colour this change
           is about, so it keeps its bare element. */
        <p className="text-caption text-accent-yellow">
          The exchange rate is out of date, so these figures are indicative.
        </p>
      ) : null}

      {preview.hasEnoughBalance === false ? (
        <Text variant="micro" color="alert" as="p">
          Not enough {preview.fiatCurrency} to cover this send and its fee.
        </Text>
      ) : null}
    </div>
  );
}
