import { Card, Skeleton, Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import type { PaymentPreview } from '@/lib/api';

export interface PayPreviewSummaryProps {
  preview: PaymentPreview | null;
  /** True while a fresh quote is in flight. */
  loading?: boolean;
}

function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      className={
        emphasis
          ? 'flex items-baseline justify-between gap-4 border-t border-hairline-light pt-2'
          : 'flex items-baseline justify-between gap-4'
      }
    >
      <Text variant="body" color="secondary" as="span">
        {label}
      </Text>
      <Text variant="body" as="span" tabular>
        {value}
      </Text>
    </div>
  );
}

/** `2.00` → `2`: a rate is not money, so no trailing zeros. */
function formatPercent(value: string): string {
  const percent = Number(value);
  return Number.isFinite(percent) ? String(percent) : value;
}

/**
 * What the customer is about to spend, itemised.
 *
 * Four rows: the merchant's amount, the platform fee, the network gas, and the
 * total that leaves the wallet. The fee is named "platform fee" on every surface
 * — it was "merchant fee" here and "Seti fee" on the send panel, which made one
 * charge look like two different things depending on the screen.
 *
 * The rate is the share of the MERCHANT's amount (the principal), which is what
 * the fee is charged on; the preview also carries `feeCapped`,
 * `minimumTicketForFloor` and `fxRateStale`, and the UI still ignores them
 * deliberately — deciding what to do when the FX rate is stale is a product
 * decision, not a rendering detail.
 *
 * `total` includes the gas estimate, so the customer's own gas is visible rather
 * than silently added to the amount the merchant receives (`grossAsset` is that
 * amount, and it is what an `inside-transfer` signature carries).
 */
export function PayPreviewSummary({ preview, loading }: PayPreviewSummaryProps) {
  const showSkeleton = loading && !preview;

  if (!preview && !showSkeleton) return null;

  return (
    <Card inset className="space-y-3">
      {showSkeleton ? (
        <>
          <Text variant="micro" as="p">
            Pricing payment…
          </Text>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </>
      ) : preview ? (
        <>
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
            value={`${preview.networkFeeSource === 'estimate' ? '≈ ' : ''}${formatFiat(Number(preview.networkFeeFiat), preview.fiatCurrency)}`}
          />
          <Row
            label="You send"
            value={formatFiat(Number(preview.totalFiat), preview.fiatCurrency)}
            emphasis
          />
          {preview.fxRateStale ? (
            <Text variant="micro" color="alert" as="p">
              The exchange rate is out of date, so these figures are indicative.
            </Text>
          ) : null}
          {preview.hasEnoughBalance === false ? (
            <Text variant="micro" color="alert" as="p">
              Not enough {preview.fiatCurrency} for this payment.
            </Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
