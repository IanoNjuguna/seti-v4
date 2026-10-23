import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useHighlightOnChange } from '@/hooks/useHighlightOnChange';
import { quoteRows } from './quoteRows';
import type { FeeQuoteProps } from './FeeQuote.types';

/**
 * One line of the quote: a quiet label, the money beside it.
 *
 * On the dark canvas both halves drop to the small role. The card exists to make
 * the TOTAL the loudest thing on it — that is the number the customer is deciding
 * about — and three rows of body-sized figures competing with it is how a summary
 * turns into a table nobody's eye lands on. Small rows, one big total: the
 * neobank review block, and the reason the white-on-black contrast is worth having
 * at all.
 */
function Row({ label, value, tone }: { label: string; value: string; tone: FeeQuoteProps['tone'] }) {
  const dark = tone === 'dark';

  return (
    <div className="flex items-baseline justify-between gap-4">
      <Text variant="micro" as="span" color={dark ? 'inverse-muted' : 'secondary'}>
        {label}
      </Text>
      <Text variant="micro" as="span" color={dark ? 'inverse' : undefined} tabular>
        {value}
      </Text>
    </div>
  );
}

/**
 * The total, on its own row under a hairline.
 *
 * A raw `<span>` rather than `Text` for the figure, and that is a finding against
 * the primitive rather than a preference: `Text` forwards no ref, and the change
 * highlight needs one DOM node to toggle a class on. The classes below are exactly
 * what `variant="body-medium"` resolves to on each surface, so this renders
 * identically.
 *
 * The figure's colour FADES when the total changes (`app/app/motion.css`,
 * `design/motion.md` DIAL TWO): a number that animates through false values in a
 * payments app is a trust problem, so the figure changes instantly and only its
 * colour says "this is new".
 */
function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: FeeQuoteProps['tone'];
}) {
  const ref = useHighlightOnChange<HTMLSpanElement>(value);
  const dark = tone === 'dark';

  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-t pt-3',
        dark ? 'border-hairline-dark' : 'border-hairline-light'
      )}
    >
      <Text variant="micro" as="span" color={dark ? 'inverse-muted' : 'secondary'}>
        {label}
      </Text>
      <span
        ref={ref}
        className={cn(
          'font-tabular',
          dark ? 'text-body-lg font-semibold text-on-dark' : 'text-body-md-bold text-ink'
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * What the customer is about to spend, itemised — the ONE quote table.
 *
 * The rows themselves are `quoteRows`, a pure function, and that is deliberate: the
 * four figures are asserted by `check:repeat-send`: the platform fee (the leg that
 * reaches the treasury) and the total especially, and a check can only assert what
 * the screen actually draws if the screen draws from the thing the check reads. This
 * component owns the drawing: the well, the row grammar, and the two warnings.
 *
 * The rate is the share of the PRINCIPAL, which is what the fee is charged on:
 * quoting it against the total would overstate it, and a customer checking the
 * arithmetic is entitled to find it exact. Gas wears a `≈` when the server called
 * it an estimate and drops it when it fell back to its conservative reserve — the
 * figure is real in the first case and a floor in the second, and the table should
 * not pretend otherwise.
 *
 * The two warnings are one size and one shape, differing only in role: a stale
 * rate is a caution (`warning`), a short balance is a refusal (`alert`). The
 * short-balance sentence takes the branch's NOUN, because "this payment" is wrong
 * when the customer is sending to a person and the flow already knows which it is.
 *
 * The refusal says "money", not the currency (the owner dictated it): the figures
 * directly above it state the unit, so naming it again would be the third time on
 * one card, and a person reading "not enough money" knows which money — it is the
 * balance they are looking at.
 *
 * The pricing placeholder is four bars on the well's own 12px step, matching the
 * four rows that replace it — the well used to promise two bars and then grow to
 * four rows, moving the Commit button 40px at the exact moment the customer was
 * reading the price.
 */
export function FeeQuote({ preview, loading, tone, subject }: FeeQuoteProps) {
  const dark = tone === 'dark';
  const well = cn('space-y-3 rounded-md p-3', dark ? 'bg-canvas-dark' : 'bg-surface-soft');

  if (!preview) {
    return loading ? (
      <div className={well} role="status" aria-label="Pricing this transfer">
        {[1, 2, 3, 4].map((row) => (
          <span
            key={row}
            className={cn(
              'block h-4 rounded-sm',
              row === 2 ? 'w-3/4' : row === 3 ? 'w-2/3' : 'w-full',
              dark ? 'bg-surface-elevated' : 'bg-faint'
            )}
          />
        ))}
      </div>
    ) : null;
  }

  return (
    <div className={well}>
      {quoteRows(preview).map((row) =>
        row.total ? (
          <Total key={row.key} label={row.label} value={row.value} tone={tone} />
        ) : (
          <Row key={row.key} label={row.label} value={row.value} tone={tone} />
        )
      )}

      {preview.fxRateStale ? (
        <Text variant="micro" as="p" color="warning">
          The exchange rate is out of date, so these figures are indicative.
        </Text>
      ) : null}

      {preview.hasEnoughBalance === false ? (
        <Text variant="micro" as="p" color="alert">
          {`Not enough money to cover this ${subject} and its fee.`}
        </Text>
      ) : null}
    </div>
  );
}
