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
 * The well the face sits in: NEUTRAL, never a tone.
 *
 * The brand mark is drawn in the colourway the surface dictates, and the cream mark on a
 * coloured circle is the one pair `BrandMark`'s own rule forbids. So it takes the same neutral
 * well a shortcut's mark uses — the same well, on every surface, for every account.
 */
export const MARK_WELL_CLASS = 'bg-surface-soft';
