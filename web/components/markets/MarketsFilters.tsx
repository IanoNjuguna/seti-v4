'use client';

import { CATEGORY_CHIPS, MARKETS_COPY } from '@/lib/markets';
import { cn } from '@/lib/cn';
import { Text } from '@/components/ui';
import type { MarketsFiltersProps, MarketsFilterValue } from './markets.types';

/**
 * Category chips.
 *
 * A real `<button>` per chip with `aria-pressed`, not a link and not a `role=tab`:
 * this filters one list in place, so nothing navigates and nothing is a new view.
 *
 * The selected chip is the black fill (`bg-canvas-dark` on white). On this surface
 * black is the primary action colour, and a cobalt selection would read as a link.
 * The row scrolls horizontally below `sm` so six chips never squash into a grid of
 * two-line labels.
 */
export function MarketsFilters({ value, onChange }: MarketsFiltersProps) {
  return (
    <div
      role="group"
      aria-label={MARKETS_COPY.filterLabel}
      className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {CATEGORY_CHIPS.map((chip) => (
        <Chip key={chip.id} active={chip.id === value} label={chip.label} onClick={() => onChange(chip.id)} />
      ))}
    </div>
  );
}

interface ChipProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function Chip({ active, label, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-sm px-3 py-2 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light',
        active ? 'bg-canvas-dark' : 'bg-surface-soft hover:bg-surface-elevated'
      )}
    >
      <Text variant="micro" color={active ? 'inverse' : 'secondary'}>
        {label}
      </Text>
    </button>
  );
}

export type { MarketsFilterValue };
