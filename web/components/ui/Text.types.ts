import type { ReactNode } from 'react';

export type TextVariant =
  | 'balance'
  | 'section'
  | 'card-title'
  | 'body'
  | 'body-medium'
  | 'micro'
  | 'button'
  | 'tab';

export type TextColor = 'primary' | 'secondary' | 'inverse' | 'inverse-muted' | 'accent' | 'alert';

export interface TextProps {
  variant?: TextVariant;
  color?: TextColor;
  /** Tabular figures. Required on every monetary value (DESIGN.md §3). */
  tabular?: boolean;
  className?: string;
  children: ReactNode;
  /**
   * Optional DOM id. Needed so a field can point `aria-describedby` at its own
   * validation message — the message has to be addressable to be announced.
   */
  id?: string;
  /** Rendered element. Defaults to `span` so it can sit inside any parent. */
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'label';
}
