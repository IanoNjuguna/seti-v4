import { Card, Text } from '@/components/ui';
import { PracticeNote } from '@/components/app/PracticeNote';
import { formatFiat } from '@/lib/formatCurrency';
import { useHighlightOnChange } from '@/hooks/useHighlightOnChange';
import type { PaymentPreview } from '@/lib/api';

export interface PayPreviewSummaryProps {
  preview: PaymentPreview | null;
  /** True while a fresh quote is in flight. */
  loading?: boolean;
}

/**
 * One line of the quote. The label is `micro` (14/`secondary`) and the figure is
 * `body` (16) in tabular figures, so the money is always the louder half — a label
 * that competes with its own number is how a table of money becomes a paragraph.
 * The total is `body-medium` (16/600) under a hairline: the strongest step the
 * scale has below a heading.
 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <Text variant="micro" color="secondary" as="span">
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
 * The total, on its own row under a hairline.
 *
 * A raw `<span>` rather than `Text` for the figure, and that is a finding
 * against the primitive rather than a preference: `Text` forwards no ref, and
 * the change highlight needs one DOM node to toggle a class on. The three classes
 * below are exactly what `variant="body-medium"` resolves to
 * (`text-body-md-bold` + `text-ink`), so this renders identically.
 *
 * The figure's colour FADES when the total changes (`app/app/motion.css`,
 * `design/motion.md` DIAL TWO): a number that animates through false values in a
 * payments app is a trust problem, so the figure changes instantly and only its
 * colour says "this is new". Never on the first paint — the quote's arrival is
 * already carried by a haptic, and guardrail 6 forbids stacking channels.
 */
function Total({ label, value }: { label: string; value: string }) {
  const ref = useHighlightOnChange<HTMLSpanElement>(value);

  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-hairline-light pt-3">
      <Text variant="micro" color="secondary" as="span">
        {label}
      </Text>
      <span ref={ref} className="font-tabular text-body-md-bold text-ink">
        {value}
      </span>
    </div>
  );
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
 * `minimumTicketForFloor` and `fxRateStale`, and the UI still ignores the first
 * two deliberately — deciding what to do when the FX rate is stale is a product
 * decision, not a rendering detail.
 *
 * `total` includes the gas estimate, so the customer's own gas is visible rather
 * than silently added to the amount the merchant receives (`grossAsset` is that
 * amount, and it is what an `inside-transfer` signature carries).
 *
 * The pricing placeholder is four bars on the well's own 12px step, matching the
 * four rows that replace it — the well used to promise two bars and then grow to
 * four rows, moving the Pay button 40px at the exact moment the customer was
 * reading the price.
 */
export function PayPreviewSummary({ preview, loading }: PayPreviewSummaryProps) {
  const showSkeleton = loading && !preview;

  if (!preview && !showSkeleton) return null;

  return (
    <Card inset className="space-y-3">
      {showSkeleton ? (
        <div className="space-y-3" role="status" aria-label="Pricing payment">
          <span className="block h-4 w-full rounded-sm bg-faint" />
          <span className="block h-4 w-3/4 rounded-sm bg-faint" />
          <span className="block h-4 w-2/3 rounded-sm bg-faint" />
          <span className="block h-4 w-full rounded-sm bg-faint" />
        </div>
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
          <Total label="You send" value={formatFiat(Number(preview.totalFiat), preview.fiatCurrency)} />
          {/* The one line that says what the figures above are. Under the total,
              so it is inside the card a screenshot of the confirm screen catches. */}
          <PracticeNote surface="light" />
          {preview.fxRateStale ? (
            <Text variant="micro" color="warning" as="p">
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
