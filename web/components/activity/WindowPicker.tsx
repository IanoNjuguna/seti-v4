'use client';

import { cn } from '@/lib/cn';
import { Text } from '@/components/ui';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { WindowPickerProps } from './Analytics.types';

/**
 * Seven days or thirty, as two presses.
 *
 * `aria-pressed` rather than a tablist: these are toggles over one panel, not
 * separate views of their own, and a second tablist inside a tabpanel would name a
 * group that owns nothing. Each button is 44px tall and sits on a soft well, so the
 * selected one is a surface change plus an ink change rather than a colour alone.
 */
export function WindowPicker({ windows, selected, onSelect }: WindowPickerProps) {
  return (
    <div role="group" aria-label={ANALYTICS_COPY.windowLabel} className="flex gap-1 rounded-lg bg-surface-soft p-1">
      {windows.map((entry) => {
        const active = entry.days === selected;

        return (
          <button
            key={entry.days}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(entry.days)}
            className={cn(
              'flex min-h-9 flex-1 items-center justify-center rounded-md px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              active ? 'bg-canvas-light shadow-none' : 'hover:bg-canvas-light/60'
            )}
          >
            <Text variant="micro" as="span" color={active ? 'primary' : 'secondary'}>
              {entry.days === 7 ? '7 days' : `${entry.days} days`}
            </Text>
          </button>
        );
      })}
    </div>
  );
}
