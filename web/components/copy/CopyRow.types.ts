/** The surface the row is drawn on — decides the value's and the control's colour. */
export type CopyRowSurface = 'light' | 'dark';

export interface CopyRowProps {
  /** What the row SHOWS. The control is drawn immediately after it. */
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
   *
   * A wrapped value and its control are ONE unit: the value flows first and the
   * control sits on the line the value's last character is on, stepping to the
   * next line rather than being pushed off the edge. Without it the value is a
   * single truncated line and the control follows the truncation.
   */
  wrap?: boolean;
  /**
   * Where the value sits on its line. `center` is for a row inside a centred column,
   * where a left-aligned one would be the only edge on the page pointing the other way
   * (the receive page's address, #419). Semantic rather than a class, for the reason the
   * value roles are: `cn()` is a plain join, so a caller's `text-*` would fight the base.
   */
  align?: 'start' | 'center';
  /**
   * The size the value is drawn at. `caption` is one step down, for a 42-character
   * address in a phone-width column: at `body` it wrapped two characters onto a second
   * line and left the copy control beside the orphan (#419).
   */
  size?: CopyRowSize;
}

/** The value sizes a row may be drawn at. */
export type CopyRowSize = 'body' | 'caption';
