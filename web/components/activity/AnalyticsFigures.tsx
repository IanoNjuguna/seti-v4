'use client';

import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsFiguresProps } from './Analytics.types';

/**
 * The three figures, as rows a reader can subtract.
 *
 * Rows rather than a three-across row of tiles: `KES 269,270,216.43` does not fit in a
 * third of a 390px screen, and three columns of different-length numbers share no
 * edge, so the eye has nothing to compare them along. Stacked rows give every figure
 * the same right edge and the same tabular digits, which is what makes them
 * comparable at a glance.
 *
 * The net is the emphasised row because it is the answer; `in` and `out` are its two
 * halves. It is also the figure the server derives from the other two, so a reader
 * subtracting them gets it exactly.
 */
export function AnalyticsFigures({ window, currency }: AnalyticsFiguresProps) {
  return (
    <ul className="flex flex-col">
      <li>
        <FigureRow label={ANALYTICS_COPY.in} value={formatFiat(Number(window.in), currency)} />
      </li>
      <li>
        <FigureRow label={ANALYTICS_COPY.out} value={formatFiat(Number(window.out), currency)} />
      </li>
      <li>
        <FigureRow
          label={ANALYTICS_COPY.net}
          value={formatFiat(Number(window.net), currency)}
          emphasis
        />
      </li>
    </ul>
  );
}

interface FigureRowProps {
  label: string;
  value: string;
  emphasis?: boolean;
}

function FigureRow({ label, value, emphasis = false }: FigureRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline-light py-3 last:border-b-0">
      <Text variant="micro" as="span" color="secondary">
        {label}
      </Text>
      <Text variant={emphasis ? 'body-medium' : 'body'} as="span" tabular>
        {value}
      </Text>
    </div>
  );
}
