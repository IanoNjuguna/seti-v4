/**
 * The two faces the mark wears, and the two canvases it is drawn for.
 *
 * `neutral` is the default identity: precision, no expression. `friendly` is the
 * expressive variant, and it is for the moments the product addresses a person
 * rather than identifies itself.
 *
 * The canvas is chosen by the SURFACE, never by taste: the cream mark on white is
 * 1.3:1, so on `canvas-dark` the mark is the white one and on a light surface it
 * is the cream one. See `design-kit/seti.live/marks/README.md` for the role map.
 */
export type BrandExpression = 'neutral' | 'friendly';
export type BrandCanvas = 'light' | 'dark';

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
