'use client';

import { Text } from '@/components/ui';
import { formatFiat } from '@/lib/formatCurrency';
import type { PolymarketPosition } from '@/lib/api/polymarket.types';

/**
 * One Polymarket holding (#599).
 *
 * A grid of two columns rather than a flex row, because the point of a list of money is
 * that the money lines up: every figure in the right column shares one right edge, and the
 * title column takes the remaining width and clamps at two lines instead of pushing the
 * figure off the row.
 *
 * `tabular` on both figures for the same reason. A PnL that changes width as it changes
 * value makes a live number look like it is jittering.
 *
 * The gain is printed with an explicit `+` and the loss carries the formatter's own minus:
 * a PnL without a sign is a number nobody can classify at a glance.
 */
export function PositionRow({ position, currency }: { position: PolymarketPosition; currency: string }) {
  const gain = position.totalPnlFiat >= 0;
  const meta = [position.outcome, position.redeemable ? 'Ready to redeem' : null].filter(Boolean).join(' · ');

  return (
    <li className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-t border-hairline-light py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <Text variant="body" as="p" className="line-clamp-2">
          {position.title}
        </Text>
        {meta ? (
          <Text variant="micro" color="secondary" as="p">
            {meta}
          </Text>
        ) : null}
      </div>
      <div className="text-right">
        <Text variant="body" as="p" tabular>
          {formatFiat(position.currentValueFiat, currency)}
        </Text>
        <Text variant="micro" color={gain ? 'success' : 'alert'} as="p" tabular>
          {gain ? `+${formatFiat(Math.abs(position.totalPnlFiat), currency)}` : formatFiat(position.totalPnlFiat, currency)}
        </Text>
      </div>
    </li>
  );
}
