'use client';

import { Text } from '@/components/ui';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsTileRowProps } from './Analytics.types';

/**
 * The three numbers under the bar (#534).
 *
 * What they replace is a line of prose: `Money in: 0 payments, average KES 0.00, median
 * KES 0.00 · Money out: 0 payments, average KES 0.00, median KES 0.00`. Four figures per half in
 * one sentence, printed whether or not the half carried anything, which on a quiet week is a
 * paragraph of zeroes above the chart.
 *
 * So the same facts are laid out as three cells instead. Each is one number with a name, they share
 * edges, and the eye compares them without parsing a sentence:
 *
 *  - **Payments**, the count the hero's figure is made of.
 *  - **Typical payment**, the median of the direction the hero prints. The median rather than the
 *    average because one large payment drags an average and says nothing about the rest.
 *  - **Net**, kept because it is the only figure about the account rather than about one direction
 *    of it, and small enough here to read as arithmetic. Its operands are the two amounts printed
 *    above it, so anyone who subtracts them lands on this number exactly.
 *
 * ## Three columns become three rows on a phone
 *
 * At 390px a third of the width is 117px, and `KES -148.03` at body-medium is wider than that: the
 * figure truncated to `KES -148…` on the narrowest screen, which is a money figure that has lost
 * its value to fit a layout. Below `sm` each cell is a row instead — the name on the left, the
 * number on the right, the same shared edge — so nothing is cut and the amounts still line up.
 *
 * No colour on a negative: `design/revolut.md` reserves brick for failure, and a week spent paying
 * merchants is not a failure.
 */
export function AnalyticsTileRow({ payments, typical, net }: AnalyticsTileRowProps) {
  return (
    <div className="flex flex-col divide-y divide-hairline-light border-y border-hairline-light sm:flex-row sm:items-stretch sm:divide-x sm:divide-y-0">
      <Tile label={ANALYTICS_COPY.figures.payments} value={String(payments)} first />
      <Tile label={ANALYTICS_COPY.figures.typical} value={typical} />
      <Tile label={ANALYTICS_COPY.figures.net} value={net} />
    </div>
  );
}

interface TileProps {
  label: string;
  value: string;
  /** The leading cell carries no left padding, so the row starts on the page's own edge. */
  first?: boolean;
}

/** One cell: a row on a phone, a column above `sm`. */
function Tile({ label, value, first = false }: TileProps) {
  return (
    <div
      className={[
        'flex min-w-0 items-baseline justify-between gap-4 py-3 sm:flex-1 sm:flex-col sm:items-start sm:justify-start sm:gap-1',
        first ? 'sm:pr-3' : 'sm:px-3',
      ].join(' ')}
    >
      <Text variant="micro" as="span" color="secondary">
        {label}
      </Text>
      <Text variant="body-medium" as="span" tabular className="shrink-0 sm:truncate">
        {value}
      </Text>
    </div>
  );
}
