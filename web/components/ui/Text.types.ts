import type { AriaRole, ReactNode } from 'react';

export type TextVariant =
  | 'balance'
  | 'balance-compact'
  | 'balance-tight'
  | 'heading-md'
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
  /**
   * The four STATUS roles. Each names an ink token that resolves per CANVAS
   * (`--color-ink-*` in `app/globals.css`): the text-grade step of its accent on
   * the white canvas, the accent itself inside a dark canvas. The role is the
   * same everywhere; only its value changes with the surface it is drawn on, so
   * a status word cannot be legible here and invisible there.
   */
  | 'success'
  | 'warning'
  /**
   * The reserved warning-ORANGE product accent. Distinct from `warning`, which is
   * the status role a caution line wears on a light card: this is the colour the
   * chrome marks PRACTICE in, where yellow would read as a status and orange
   * reads as a state of the account. On the black chrome it is `accent-warning`
   * (7.6:1); on a white surface it steps down to its own text grade.
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
