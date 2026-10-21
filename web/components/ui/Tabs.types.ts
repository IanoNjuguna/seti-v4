import type { KeyboardEvent } from 'react';

/** One switchable view. `id` is what the URL carries and what `aria-controls` joins on. */
export interface TabItem<Id extends string = string> {
  id: Id;
  label: string;
}

/**
 * The rail of tabs itself.
 *
 * `idPrefix` namespaces the ids: two tablists on one page would otherwise claim the
 * same `tab-0`, and `aria-controls` would point at the wrong panel while looking
 * perfectly correct in the source.
 */
export interface TabsProps<Id extends string = string> {
  items: readonly TabItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  /** Names the group for a screen reader: "Activity views", not "Tabs". */
  label: string;
  idPrefix: string;
}

export type UseTabsInput<Id extends string = string> = Omit<TabsProps<Id>, 'label'>;

export interface UseTabsReturn<Id extends string = string> {
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  registerTab: (id: Id) => (node: HTMLButtonElement | null) => void;
  tabId: (id: Id) => string;
  panelId: (id: Id) => string;
}

/** The panel a tab controls. Owns the `role` wiring so a panel cannot drift from its tab. */
export interface TabPanelProps {
  idPrefix: string;
  /** The tab this panel belongs to. */
  tabId: string;
  /** Draw the panel only when its tab is the selected one. */
  visible: boolean;
  children: React.ReactNode;
}
