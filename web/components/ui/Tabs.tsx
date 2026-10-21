'use client';

import { cn } from '@/lib/cn';
import { Text } from './Text';
import { useTabs } from './useTabs';
import type { TabPanelProps, TabsProps } from './Tabs.types';

/**
 * A horizontal tablist on the app's light canvas.
 *
 * The indicator is a 2px rule on the active tab, sitting ON the strip's own hairline
 * (`-mb-px` + `border-b-2`), so the selected state reads as the line the section
 * belongs to rather than as a floating underline 1px below it. Colour is never the
 * only signal: `aria-selected` moves with it, and the label's ink goes from muted to
 * full.
 *
 * Every tab is at least 44px tall, because the label's line box alone is 20px and a
 * tab that is only as tall as its text is a miss on a phone.
 */
export function Tabs<Id extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
}: TabsProps<Id>) {
  const { onKeyDown, registerTab, tabId, panelId } = useTabs({ items, value, onChange, idPrefix });

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-6 border-b border-hairline-light"
    >
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
              '-mb-px flex min-h-11 items-center border-b-2 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light',
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

/**
 * The other half of the pair. Unselected panels are `hidden`, never unmounted here:
 * keeping both alive is what lets a switch back be instant, and the `hidden`
 * attribute is what keeps the invisible one out of the accessibility tree and out
 * of the tab order.
 */
export function TabPanel({ idPrefix, tabId, visible, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${tabId}`}
      aria-labelledby={`${idPrefix}-tab-${tabId}`}
      hidden={!visible}
      tabIndex={0}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light"
    >
      {children}
    </div>
  );
}
