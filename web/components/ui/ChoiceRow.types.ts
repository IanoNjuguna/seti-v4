export interface ChoiceRowProps {
  /** The option, in the customer's words. One line: the detail carries the rest. */
  label: string;
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
  className?: string;
}
