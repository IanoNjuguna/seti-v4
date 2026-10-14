'use client';

import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { formatBalance, formatDelta } from './home.format';
import { useBalanceVisibility } from './useBalanceVisibility';
import type { BalanceCardProps } from './BalanceCard.types';

/**
 * The hero: the balance, on the system's dark canvas.
 *
 * `canvas-dark` is how the Revolut system signals a premium focal surface, and
 * it is what makes the balance read as the most important thing on the screen
 * without a shadow (the system has none) or an accent colour (cobalt is
 * reserved for links). The hide control is next to the number it changes, and
 * its label says what tapping it will do.
 *
 * One thing, the balance. Deposit and Send — and the panels they opened inside
 * this card — are tiles in the quick-actions strip below, each on a page of its
 * own. A hero that is also a menu is neither: the card no longer owns local
 * panel state, an action row, or a focus-return dance for a row it hides.
 */
export function BalanceCard({ data }: BalanceCardProps) {
  const { hidden, toggle } = useBalanceVisibility();
  const delta = data?.monthToDateDelta ?? 0;

  return (
    <section
      aria-labelledby="balance-heading"
      className="rounded-md bg-canvas-dark p-6 text-on-dark sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Text variant="micro" as="p" color="inverse-muted">
            <span id="balance-heading">Available balance</span>
          </Text>
          <Text variant="balance" tabular as="p" color="inverse" className="mt-2">
            {hidden ? `${data?.currency ?? ''} ••••••` : formatBalance(data?.balance, data?.currency)}
          </Text>
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-pressed={hidden}
          aria-label={hidden ? 'Show balances' : 'Hide balances'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-dark-mute transition-colors hover:bg-surface-elevated hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
        >
          <Icon name={hidden ? 'eyeOff' : 'eye'} />
        </button>
      </div>

      {delta !== 0 ? (
        <p className="mt-1 text-body-sm text-on-dark-mute">{formatDelta(delta)} this month</p>
      ) : null}
    </section>
  );
}
