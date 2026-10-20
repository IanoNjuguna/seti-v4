'use client';

import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { formatFiat } from '@/lib/formatCurrency';
import { allocateFiat } from './allocate';
import { BREAKDOWN_COPY } from './AssetBreakdown.constants';
import { useAssetBreakdown } from './useAssetBreakdown';
import type { AssetBreakdownProps } from './AssetBreakdown.types';

/**
 * What the headline is made of, one tap away.
 *
 * Closed by default and never shown to a visitor, because there is nothing to break
 * down until an account is confirmed. The rows come from the dashboard's `assets` and
 * their fiat share is allocated from the headline itself, so the parts always add to
 * the whole rather than to a separate conversion of it.
 *
 * The token amount and the fiat are both shown, on purpose: this is a crypto balance,
 * and a breakdown that named four stablecoins without their amounts would answer the
 * question halfway.
 */
export function AssetBreakdown({ rows, total, hidden, currency }: AssetBreakdownProps) {
  const { open, toggle, panelId } = useAssetBreakdown();

  if (rows.length === 0) return null;

  const shares = allocateFiat(rows, total);

  return (
    <div className="mt-4 border-t border-hairline-dark pt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 items-center gap-1.5 rounded-sm text-on-dark-mute transition-colors duration-(--duration-quick) ease-out hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
      >
        {/**
          * The label does not change when it opens. A control whose words swap under
          * the cursor reads as two different controls, and the chevron plus
          * `aria-expanded` already say which state it is in.
          */}
        <Text variant="micro" as="span" color="inverse-muted">
          {BREAKDOWN_COPY.show}
        </Text>
        <Icon name="chevronRight" className={open ? 'h-4 w-4 rotate-90' : 'h-4 w-4'} />
      </button>

      {open ? (
        <ul id={panelId} className="mt-1 flex flex-col">
          {shares.map((share) => (
            <li
              key={share.asset}
              className="flex items-baseline justify-between gap-3 border-b border-hairline-dark py-2.5 last:border-b-0"
            >
              <div className="flex min-w-0 flex-col">
                <Text variant="body-medium" as="span" color="inverse">
                  {share.symbol}
                </Text>
                <Text variant="micro" as="span" color="inverse-muted" tabular>
                  {hidden ? BREAKDOWN_COPY.redacted : share.amount}
                </Text>
              </div>
              <Text variant="body-medium" as="span" color="inverse" tabular>
                {hidden ? BREAKDOWN_COPY.redacted : formatFiat(Number(share.fiat), currency)}
              </Text>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
