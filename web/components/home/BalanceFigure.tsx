'use client';

import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import type { TextVariant } from '@/components/ui/Text.types';
import { AssetBreakdown } from './AssetBreakdown';
import { formatBalance, formatDelta } from './home.format';
import { useBalanceVisibility } from './useBalanceVisibility';
import type { BalanceFigureProps } from './BalanceFigure.types';

/**
 * The balance itself: the figure, the hide control, and the month's movement.
 *
 * The figure is EXACT and pinned to one line. It used to compact at a million
 * ("KES 4.8M") to stop a long number wrapping, which put a rounded figure where
 * spendable money belongs and contradicted the same account's Activity list. The
 * width risk moves to the type instead: the display step holds up to a
 * 14-character amount, then steps down once, then again. Rounded is worse than
 * smaller, and wrapping a figure mid-value is worse than both.
 *
 * The hide control sits beside the number it changes and its label says what
 * tapping it will do — and it lives HERE, with the figure, because it is a
 * control for a value: a card with no value to hide (`BalanceNote`) must not
 * offer a control that does nothing.
 *
 * The card's own surface belongs to `BalanceCard`, which picks this body or that
 * one; the delta stays outside the row so it sits under the figure rather than
 * beside the hide control.
 */
export function BalanceFigure({ data }: BalanceFigureProps) {
  const { hidden, toggle } = useBalanceVisibility();
  const delta = data?.monthToDateDelta ?? 0;
  const figure = hidden
    ? `${data?.currency ?? ''} ••••••`
    : formatBalance(data?.balance, data?.currency);

  // Thresholds are character counts on the PHONE, where the card is narrowest: a
  // 14-character amount ("KES 996,626.73") holds the display step, a 17-character one
  // ("KES 9,999,999.99") steps down once, and anything longer steps down again. On wider
  // screens the same variant is one step larger, so the desktop hero stays big.
  const balanceVariant: TextVariant =
    figure.length <= 14 ? 'balance' : figure.length <= 17 ? 'balance-compact' : 'balance-tight';

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Text variant="micro" as="p" color="inverse-muted">
            <span id="balance-heading">Available balance</span>
          </Text>
          <Text
            variant={balanceVariant}
            tabular
            as="p"
            color="inverse"
            className="mt-2 whitespace-nowrap"
          >
            {figure}
          </Text>
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-pressed={hidden}
          aria-label={hidden ? 'Show balances' : 'Hide balances'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-dark-mute transition-colors duration-(--duration-quick) ease-out hover:bg-surface-elevated hover:text-on-dark active:bg-surface-elevated active:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
        >
          <Icon name={hidden ? 'eyeOff' : 'eye'} />
        </button>
      </div>

      {delta !== 0 ? (
        <Text variant="micro" as="p" color="inverse-muted" className="mt-1">
          {formatDelta(delta)} this month
        </Text>
      ) : null}

      {/* Only once the dashboard has landed: a visitor never reaches this body, and an
          account whose read is still in flight has no rows to break down. */}
      {data && data.currency ? (
        <AssetBreakdown
          rows={data.assets}
          total={data.balance}
          hidden={hidden}
          currency={data.currency}
        />
      ) : null}
    </>
  );
}
