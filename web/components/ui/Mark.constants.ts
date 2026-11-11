import type { MarkSize } from './Mark.types';

/**
 * The three sizes the mark exists at.
 *
 * `lg` is the profile header, `md` is the 40px well a row reserves, `sm` is the same object at
 * the size a dense list can afford. A shared rhythm, not a wrapper with padding.
 */
export const MARK_SIZE_CLASS: Record<MarkSize, string> = {
  lg: 'h-16 w-16',
  md: 'h-10 w-10',
  sm: 'h-8 w-8',
};

/**
 * The face inside the well, per size.
 *
 * Set by hand at each step rather than derived from the box: the mark is art with its own
 * optical weight, and scaling it from the container is how a 64px well ends up with a glyph
 * that reads 4px too small.
 */
export const MARK_GLYPH_CLASS: Record<MarkSize, string> = {
  lg: 'h-9 w-9',
  md: 'h-6 w-6',
  sm: 'h-5 w-5',
};

export const MARK_BASE_CLASS =
  'inline-flex shrink-0 select-none items-center justify-center rounded-full';

/**
 * The well the face sits in: the DARK canvas.
 *
 * A medallion, not a chip. The profile header is an identity block, so the face gets an object
 * to sit in — the same pairing the sign-in page already uses, which is why the mark is the
 * near-white colourway in here and the disc is black.
 *
 * ## Measured, because the last pairing was not
 *
 * It used to be the CREAM mark on `surface-soft`: #dfd6cd on #f4f4f4, **1.3:1**, an avatar
 * that read as a smudge on a grey circle (#548). `BrandMark`'s own doc warns about exactly that
 * pair. This one is near-white on black: **20.3:1**.
 */
export const MARK_WELL_CLASS = 'bg-canvas-dark';

/**
 * Which colourway of the mark goes in that well.
 *
 * Exported rather than written at the call site so the pairing — this canvas, this well — is
 * one fact the check suite can hold. The mark is drawn for the canvas it sits on; picking the
 * two independently is how the 1.3:1 pair shipped.
 */
export const MARK_CANVAS = 'dark' as const;
