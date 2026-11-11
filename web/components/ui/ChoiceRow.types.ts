import type { ReactNode } from 'react';

export interface ChoiceRowProps {
  /** The option, in the customer's words. One line: the detail carries the rest. */
  label: string;
  /**
   * The option's own mark, before the label (#545).
   *
   * A token's brand is the fastest way to tell `USDC.e` from `USDT0`, and a list of tokens
   * without marks is a list of similar words. It is decoration: the label beside it already
   * names the thing, so nothing passed here needs an accessible name of its own.
   */
  mark?: ReactNode;
  /** Why you would pick this one. Optional, and never a repeat of the label. */
  detail?: string;
  /** What picking it does. The row is disabled while a choice is in flight. */
  onSelect: () => void;
  disabled?: boolean;
  /**
   * The row is the CURRENT answer, not one of several.
   *
   * A list of options still has to show which one is in force, or the person has to
   * remember what they tapped. It is `aria-pressed` rather than a tint, because a
   * colour alone is not a state a screen reader can read (#228).
   */
  selected?: boolean;
  /** A trailing chevron, for a row that opens something rather than acting in place. */
  showChevron?: boolean;
  /**
   * How the row is drawn (#545): `option` is one of a page of choices, `list` is one line of
   * a list inside a panel. The difference is the frame: an option is its own box with an ink
   * border, a list row has none and takes the list's own separators.
   */
  variant?: 'option' | 'list';
  className?: string;
}
