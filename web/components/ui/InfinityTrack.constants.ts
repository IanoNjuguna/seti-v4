/**
 * The track's geometry and its surface matching, in one place.
 *
 * `InfinityTrack` is a port of `@loading-ui/infinity-track` (shaah1d's animation,
 * fetched from `loading-ui.com/r/infinity-track.json`) into this repo's tokens. The
 * algorithm is theirs and is kept intact: a static 9x5 monospace grid draws the
 * infinity path out of `░`, and three block glyphs (`█ ▓ ▒`) travel along it on the
 * same keyframes, staggered, each painting a rectangle of the SURFACE behind it so it
 * appears to cut the path as it passes.
 *
 * ## What was changed for this repo, and why
 *
 * - **The keyframes moved into `app/globals.css`.** The registry component writes a
 *   `<style>` block inside itself, so every instance re-declares the same animation.
 *   One rule in the stylesheet is one rule, and it is where every other keyframe on
 *   the site already lives.
 * - **`--mask-color` became a `canvas` prop over tokens.** The registry asks you to
 *   pass a raw colour matching the surface, which is exactly how a loader ends up a
 *   shade off the card it sits on. `MASK_CLASS` maps the surface's own token instead.
 * - **Motion is honoured as NO motion.** The regression guard the repo already pays
 *   for: `prefers-reduced-motion` removes the travelling blocks and leaves the static
 *   track, which still says "working" without moving.
 *
 * The `ch`-based keyframes are deliberate and are the reason this needs a monospace
 * face: `--font-mono` here is JetBrains Mono, self-hosted, so a `ch` is a cell.
 */

/** The infinity path, drawn as a glyph that is not the same as the blocks riding it. */
export const INFINITY_TRACK_GLYPH = '░';

/** Filled-to-open: the three travelling blocks, painted in z-order. */
export const INFINITY_TRACK_BLOCKS = ['█', '▓', '▒'] as const;

export const INFINITY_TRACK_COLS = 9;
export const INFINITY_TRACK_ROWS = 5;

/**
 * The static path: top row, middle row, bottom row, and the three uprights, which is
 * a figure-eight on its side. Produced once at module load rather than per render.
 */
export const INFINITY_TRACK_CELLS: readonly string[] = Array.from(
  { length: INFINITY_TRACK_COLS * INFINITY_TRACK_ROWS },
  (_unused, index) => {
    const row = Math.floor(index / INFINITY_TRACK_COLS);
    const col = index % INFINITY_TRACK_COLS;
    return row === 0 || row === 4 || col === 0 || col === 4 || col === 8
      ? INFINITY_TRACK_GLYPH
      : ' ';
  }
);

/**
 * The surface the track is drawn ON, not the colour of the track.
 *
 * The track inherits `currentColor`; the mask has to be the surface's fill so the
 * passing block looks like a hole in the path. Three canvases the product actually
 * has: the black page, the white page, and the one raised dark inset.
 */
export const MASK_CLASS = {
  dark: 'bg-canvas-dark',
  light: 'bg-canvas-light',
  elevated: 'bg-surface-elevated',
} as const;

/** One `ch` per cell, so the box is exactly the grid and never half a glyph wide. */
export const SIZE_CLASS = {
  sm: 'h-[5ch] w-[9ch] text-caption',
  md: 'h-[5ch] w-[9ch] text-body-md',
  lg: 'h-[5ch] w-[9ch] text-heading-md',
} as const;

export const INFINITY_TRACK_BASE_CLASS =
  'relative inline-flex select-none overflow-hidden font-mono leading-none';

/**
 * The grid and the blocks are pinned to `1ch` cells and stacked absolutely, so the
 * glyphs never reflow the line they sit on and the track cannot change the height of
 * whatever it is loaded into.
 */
export const INFINITY_TRACK_CELL_CLASS =
  'pointer-events-none absolute top-0 left-0 flex h-[1ch] w-[1ch] items-center justify-center';

export const INFINITY_TRACK_Z_CLASS = ['z-30', 'z-20', 'z-10'] as const;

/** The dev-source and reduced-motion story, asserted by `check:otp`. */
export const INFINITY_TRACK_ANIMATION_CLASS = 'infinity-track-block';
