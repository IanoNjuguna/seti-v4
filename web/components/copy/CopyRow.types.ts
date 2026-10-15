/** The surface the row is drawn on — decides the value's and the control's colour. */
export type CopyRowSurface = 'light' | 'dark';

export interface CopyRowProps {
  /** What the row SHOWS. */
  display: string;
  /**
   * What the control WRITES. Not always `display`: a handle is shown with its
   * `@` and copied without it, and a link is shown without its scheme and copied
   * with it.
   */
  value: string;
  /**
   * The control's accessible name, in the customer's words — "Copy username",
   * "Copy link", "Copy address".
   *
   * Required for the same reason `IconButton`'s is: the control has no visible
   * label, so this is all a screen reader or a hovering pointer is told.
   */
  label: string;
  /** Shown when the browser blocks the copy. The person has to select the text. */
  failureText: string;
  /** Announced when the copy succeeds — one word, e.g. "Copied". */
  copiedText: string;
  surface?: CopyRowSurface;
  /** The loud half of a pair — a username at `body-md-bold`, a link quiet. */
  emphasis?: boolean;
  /**
   * Let the value WRAP instead of truncating.
   *
   * For a value that has to be readable in full even when it does not fit: a
   * 42-character address, which the failure path tells the person to select and
   * copy by hand, so clipping it would hide the very string they were sent to get.
   */
  wrap?: boolean;
}
