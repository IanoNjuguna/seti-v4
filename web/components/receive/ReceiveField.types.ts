/** What the one field in a receive half renders, and what it says while doing it. */
export interface ReceiveFieldProps {
  /** The small caption above the field, naming what the value IS. */
  label: string;
  /** The string the field shows in full and the control writes to the clipboard. */
  value: string;
  /** The copy control's accessible name, in the customer's words. */
  copyLabel: string;
  /** Show when the browser refused the clipboard: the reader must copy by hand. */
  copyFailed: string;
  /** The confirmation, announced rather than drawn as a second line of prose. */
  copiedText: string;
  /**
   * A sentence under the field: the OTHER way a sender can reach this account.
   * Optional, because the address half has nothing to add to its own string.
   */
  note?: string;
}
