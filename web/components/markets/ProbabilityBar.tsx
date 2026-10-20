import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatProbability } from '@/lib/markets';
import type { ProbabilityBarProps } from './markets.types';

/**
 * The one visual claim on a card: how confident the crowd is.
 *
 * A bar rather than a big number alone, because 78% means nothing to a person who
 * has not read the question carefully, and a half-filled bar is legible before the
 * sentence is. It is decorative to a screen reader (`aria-hidden`) while the number
 * beside it carries the same value as text, so nothing is lost when the fill is.
 *
 * The width is the only inline style in this surface, and it has to be: a
 * percentage cannot be a Tailwind class generated at build time. Fills are
 * `bg-canvas-dark` (the system's primary on white) and the track is the soft
 * surface, so there is no colour that is not a token.
 */
export function ProbabilityBar({ value, label }: ProbabilityBarProps) {
  /**
   * The NUMBER and the BAR must agree, so both come from the same value: the label
   * goes through `formatProbability`, which refuses to print a live long shot as
   * `0%`, and the fill is the same fraction in whole percent. Recomputing the label
   * here is how a card ends up saying "0%" beside a <1% price.
   */
  const percent = value === null ? null : Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-surface-soft"
      >
        <div
          className={cn('h-full rounded-sm bg-canvas-dark')}
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      <Text variant="body-medium" tabular className="shrink-0">
        {percent === null ? label : formatProbability(value)}
      </Text>
    </div>
  );
}
