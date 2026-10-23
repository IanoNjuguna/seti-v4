/** What the recent-people block needs from the step that mounts it. */
export interface RecentRecipientsProps {
  /**
   * Whether the block should be drawn at all: true while the recipient field is
   * empty. The step owns that question; this component owns everything after it.
   */
  visible: boolean;
  /** A choice is in flight, so a second tap must not race the first. */
  disabled: boolean;
  /** Fills the payee field with the target the customer picked. */
  onPick: (target: string) => void;
}
