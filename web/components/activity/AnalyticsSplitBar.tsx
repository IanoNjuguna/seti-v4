'use client';

import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsSplitBarProps } from './Analytics.types';

/**
 * Money in and money out as ONE bar (#441).
 *
 * The page used to print `in`, `out` and `net` as three stacked rows, which made the reader do the
 * subtraction in their head and gave the page three figures of equal weight. Two segments of one bar
 * do the same job in a tenth of the ink: the relationship is the picture, the labels carry the
 * amounts, and the hero above is the difference the eye has just walked across.
 *
 * Colour is never the only signal. Each segment is named in words with its amount beside it, and the
 * bar itself is `aria-hidden` because it says nothing those two labels do not.
 *
 * ## Money out is stone, not ink (#534)
 *
 * The departure segment used to be `bg-ink`, the strongest colour in the system. On the ordinary
 * account that paid merchants and received nothing, that drew the whole bar in the page's heaviest
 * ink: the loudest mark on the screen was the money leaving, sitting under a legend dot that said
 * `Money in` on its left edge. Green already means money in across this app (the streak map, the
 * received line), and a full-width stone rule reads as the quiet, ordinary fact that paying
 * merchants is — decorative, `aria-hidden`, and never mistaken for an error, which is what brick
 * would say.
 */
export function AnalyticsSplitBar({ window, currency }: AnalyticsSplitBarProps) {
  const [inShare, outShare] = splitShare(window.in, window.out);
  const empty = inShare === 0 && outShare === 0;
  const fiat = (value: string): string => formatFiat(Number(value), currency);
  const fee = Number(window.paidOut.fee);

  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden className="flex h-2.5 gap-1 overflow-hidden">
        {empty ? (
          <span className="flex-1 rounded-sm bg-hairline-light" />
        ) : (
          <>
            <span
              className="rounded-sm bg-accent-light-green"
              style={{ flexGrow: inShare, flexBasis: 0 }}
            />
            <span className="rounded-sm bg-stone" style={{ flexGrow: outShare, flexBasis: 0 }} />
          </>
        )}
      </div>

      <ul className="flex items-start justify-between gap-4">
        <Segment tone="in" label={ANALYTICS_COPY.splitIn} value={fiat(window.in)} />
        <Segment tone="out" label={ANALYTICS_COPY.splitOut} value={fiat(window.out)} />
      </ul>

      {/* Only when there is a fee: `Includes KES 0.00 fee` is a caption apologising for a zero. */}
      {fee > 0 ? (
        <Text variant="micro" as="p" color="secondary">
          {ANALYTICS_COPY.feeCaption(fiat(window.paidOut.fee))}
        </Text>
      ) : null}
    </div>
  );
}

interface SegmentProps {
  tone: 'in' | 'out';
  label: string;
  value: string;
}

/** One end of the bar, on its own side of the shared edge. */
function Segment({ tone, label, value }: SegmentProps) {
  const dot = tone === 'in' ? 'bg-accent-light-green' : 'bg-stone';

  return (
    <li className={`flex min-w-0 flex-col gap-1 ${tone === 'out' ? 'items-end' : ''}`}>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <Text variant="micro" as="span" color="secondary">
          {label}
        </Text>
      </span>
      <Text variant="body-medium" as="span" tabular className="truncate">
        {value}
      </Text>
    </li>
  );
}

/**
 * Each direction's share of the window, as two flex-grow weights.
 *
 * A direction with a payment in the window never renders thinner than 2%: at a 30-day window one
 * small payment against a busy account is a sliver, and a sliver is indistinguishable from absent,
 * which would erase the difference between "barely" and "not at all". Zero and zero is the one case
 * that is drawn as a single neutral rule rather than two segments.
 */
export function splitShare(inValue: string, outValue: string): [number, number] {
  const inflow = Math.max(0, Number(inValue) || 0);
  const outflow = Math.max(0, Number(outValue) || 0);
  const total = inflow + outflow;

  if (total <= 0) return [0, 0];

  const share = (part: number): number => (part === 0 ? 0 : Math.max(2, Math.round((part / total) * 100)));
  return [share(inflow), share(outflow)];
}
