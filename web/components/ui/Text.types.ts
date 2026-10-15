import type { AriaRole, ReactNode } from 'react';

export type TextVariant =
  | 'balance'
  | 'balance-compact'
  | 'balance-tight'
  | 'section'
  | 'card-title'
  | 'body'
  | 'body-medium'
  | 'micro'
  | 'button'
  | 'tab';

export type TextColor =
  | 'primary'
  | 'secondary'
  | 'inverse'
  | 'inverse-muted'
  | 'accent'
  | 'success'
  | 'warning'
  /**
   * The reserved warning-ORANGE product accent (`accent-warning`). Distinct from
   * `warning`, which is the status role (`accent-yellow`) a caution line wears on
   * a light card: this is the colour the chrome marks PRACTICE in on black, where
   * yellow would read as a status and orange reads as a state of the account.
   */
  | 'attention'
  | 'alert';

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
  /**
   * Optional ARIA role. A text primitive can itself be an alert region (a form's
   * failure line), and without a way to say so a caller has to drop back to a raw
   * element just to attach the role — the same bypass that produced the colour
   * mess. Only the role is forwarded; nothing else about the element changes.
   */
  role?: AriaRole;
  /** Rendered element. Defaults to `span` so it can sit inside any parent. */
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'label';
}
