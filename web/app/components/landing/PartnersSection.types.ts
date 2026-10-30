/** Which of the two states an entry is in. The grouping on the page is this. */
export type PartnerState = 'live' | 'soon';

/**
 * One integration. `mark` is a path under `web/public/` — the brand asset, not a
 * name set in type, because these marks are the names.
 */
export interface PartnerEntry {
  label: string;
  state: PartnerState;
  mark: string;
  /**
   * True when the SVG draws part of itself as an embedded BITMAP. Whitening the
   * file's `fill` values reaches every vector path and nothing inside a bitmap,
   * so such a mark also needs a filter on the `<img>` to cover the rest.
   */
  hasEmbeddedBitmap?: boolean;
  /**
   * A transform that corrects a mark's optical weight inside the shared box,
   * applied to the image and inherited by nothing else.
   *
   * Only for a mark whose ARTWORK is the reason it reads small — a two-line
   * lockup whose name is half its own height. It scales the picture, not the box,
   * so the four captions stay on one baseline.
   */
  markScale?: string;
}
