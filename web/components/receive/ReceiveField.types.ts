/**
 * What a bordered field renders, and what it says while doing it.
 *
 * The `note` prop is gone with the receive link row: it existed to say what a sender
 * could do INSTEAD of the string in the box, and the only surfaces that used it were
 * the two receive halves whose link rows this change deleted. Nothing else passed it,
 * and an optional prop nobody passes is a second layout that never gets looked at.
 */
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
}
