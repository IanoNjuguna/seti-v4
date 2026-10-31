/**
 * The two faces the mark wears, and the canvases it is drawn for.
 *
 * `neutral` is the default identity: precision, no expression. `friendly` is the
 * expressive variant, and it is for the moments the product addresses a person
 * rather than identifies itself.
 *
 * The canvas is chosen by the SURFACE, never by taste: the cream mark on white is
 * 1.3:1, so on `canvas-dark` the mark is the white one and on a light surface it
 * is the cream one. See `design-kit/seti.live/marks/README.md` for the role map.
 *
 * `code` is the one canvas that is not a background but an INK: the white well in the
 * middle of a payment code, where the mark must be the same colour as the modules
 * around it (ink, 21.00:1 on white) or it reads as nothing at all. The cream pair is
 * 1.3:1 there and the white pair is 1:1.
 */
export type BrandExpression = 'neutral' | 'friendly';
export type BrandCanvas = 'light' | 'dark' | 'code';

export interface BrandMarkProps {
  expression: BrandExpression;
  canvas: BrandCanvas;
  /** Sizes the mark: pass a height, the shared square canvas gives the width. */
  className?: string;
  /** The accessible name. Omit it when a wordmark beside the mark already names
   *  the product; an unlabelled mark is decorative and stays out of the tree. */
  label?: string;
  /** Load with the document. For the mark that is on screen at first paint. */
  preload?: boolean;
}

/**
 * The lockup, for the two places that used to draw the mark and type its word beside it.
 *
 * Unlike `BrandMark` it carries a name by default: the image IS the product's name, so
 * there is no separate wordmark to carry it, and an unlabelled link here would be a link
 * with no accessible name.
 */
export interface BrandLockupProps {
  /** Sizes it: pass a height, the asset's own ratio gives the width. */
  className?: string;
  /** The accessible name. Defaults to the product's. */
  label?: string;
  /** Load with the document. The navbar's is on screen at first paint. */
  preload?: boolean;
}
