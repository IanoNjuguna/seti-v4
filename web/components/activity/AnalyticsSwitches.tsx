'use client';

import { cn } from '@/lib/cn';
import { Text } from '@/components/ui';
import { useTabs } from '@/components/ui/useTabs';
import type { TabItem } from '@/components/ui/Tabs.types';

interface AnalyticsSwitchesProps<Id extends string> {
  items: readonly TabItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  label: string;
  idPrefix: string;
}

/**
 * A tablist with text weight, for a switch that lives INSIDE a band (#534).
 *
 * ## Why not the shared `Tabs`
 *
 * `Tabs` draws a rule across the full width and puts a 2px indicator on it. That is right for a
 * tab bar that IS the page's navigation, like the Transactions/Analytics pair at the top: the
 * strip is the edge of the page's content. Here the switch sits between the chart and the data it
 * names, and a full-width rule in that position draws a third edge in a page that already has one
 * above the chart and one under the figures, so the band reads as a section that was cut off and
 * started again.
 *
 * The indicator is kept — the active label gets its own 2px underline, and its ink goes from
 * muted to full — because colour alone would leave the selected state to a subtle shade. What is
 * dropped is the strip.
 *
 * The rule between the two presentations: a tablist that changes what the PAGE is showing takes
 * the strip; a tablist that changes which short list is drawn inside a band takes the text
 * weight. Two presentations, one rule, so the next screen does not invent a third.
 *
 * Keyboard behaviour is the same object as `Tabs` — `useTabs` supplies the roving tabIndex, the
 * arrow keys and the id wiring, so this is a change of paint, not of semantics.
 */
export function AnalyticsSwitches<Id extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
}: AnalyticsSwitchesProps<Id>) {
  const { onKeyDown, registerTab, tabId, panelId } = useTabs({ items, value, onChange, idPrefix });

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-5">
      {items.map((item) => {
        const selected = item.id === value;

        return (
          <button
            key={item.id}
            ref={registerTab(item.id)}
            type="button"
            role="tab"
            id={tabId(item.id)}
            aria-selected={selected}
            aria-controls={panelId(item.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'flex min-h-11 items-center border-b-2 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light',
              selected ? 'border-ink' : 'border-transparent hover:border-hairline-light'
            )}
          >
            <Text variant="tab" as="span" color={selected ? 'primary' : 'secondary'}>
              {item.label}
            </Text>
          </button>
        );
      })}
    </div>
  );
}
