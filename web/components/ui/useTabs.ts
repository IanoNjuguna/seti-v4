'use client';

import { useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { isTabKey, nextTabIndex } from './tabs.keys';
import type { UseTabsInput, UseTabsReturn } from './Tabs.types';

/**
 * The keyboard half of a tablist, which is the only half that needs logic.
 *
 * Arrow keys move the SELECTION, not just the focus — that is the ARIA authoring
 * practice for tabs whose panels are cheap to show, and it is what a customer with a
 * keyboard expects when they press Right: the panel changes. With a slow read behind
 * each panel, manual activation would be the alternative; both panels here are one
 * read each and both stay mounted, so automatic activation is the simpler contract.
 *
 * Roving `tabIndex` is the other half: exactly one tab is in the tab order, so Tab
 * moves past the group rather than through every option in it. `Home`/`End` jump to
 * the ends because a horizontal group with four members otherwise punishes the
 * keyboard.
 *
 * The movement arithmetic lives in `tabs.keys`, where it is checked without a browser.
 */
export function useTabs<Id extends string>({
  items,
  value,
  onChange,
  idPrefix,
}: UseTabsInput<Id>): UseTabsReturn<Id> {
  const nodes = useRef<Record<string, HTMLButtonElement | null>>({});
  const index = items.findIndex((item) => item.id === value);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isTabKey(event.key)) return;

      const next = nextTabIndex(items.length, index, event.key);
      if (next === null) return;

      const item = items[next];
      if (!item) return;

      // Only prevent the default once a move is actually happening.
      event.preventDefault();
      onChange(item.id);
      nodes.current[item.id]?.focus();
    },
    [items, index, onChange]
  );

  const registerTab = useCallback(
    (id: Id) => (node: HTMLButtonElement | null) => {
      nodes.current[id] = node;
    },
    []
  );

  const tabId = useCallback((id: Id) => `${idPrefix}-tab-${id}`, [idPrefix]);
  const panelId = useCallback((id: Id) => `${idPrefix}-panel-${id}`, [idPrefix]);

  return { onKeyDown, registerTab, tabId, panelId };
}
