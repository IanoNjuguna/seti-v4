export interface ChoiceRowProps {
  /** The option, in the customer's words. One line: the detail carries the rest. */
  label: string;
  /** Why you would pick this one. Optional, and never a repeat of the label. */
  detail?: string;
  /** What picking it does. The row is disabled while a choice is in flight. */
  onSelect: () => void;
  disabled?: boolean;
  /** A trailing chevron, for a row that opens something rather than acting in place. */
  showChevron?: boolean;
  className?: string;
}
