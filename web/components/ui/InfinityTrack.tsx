import { cn } from '@/lib/cn';
import {
  INFINITY_TRACK_ANIMATION_CLASS,
  INFINITY_TRACK_BASE_CLASS,
  INFINITY_TRACK_BLOCKS,
  INFINITY_TRACK_CELL_CLASS,
  INFINITY_TRACK_CELLS,
  INFINITY_TRACK_COLS,
  INFINITY_TRACK_Z_CLASS,
  MASK_CLASS,
  SIZE_CLASS,
} from './InfinityTrack.constants';
import type { InfinityTrackProps } from './InfinityTrack.types';

/**
 * The product's one indeterminate wait, drawn as an infinity path.
 *
 * A port of `@loading-ui/infinity-track` — the algorithm, the glyphs and the keyframes
 * are the original's; the surface matching, the token sizes and the reduced-motion
 * story are this repo's. `InfinityTrack.constants` records each change and why.
 *
 * ## When this, and when a skeleton
 *
 * A skeleton claims the SHAPE of something arriving; this claims only that something
 * is running and its length is unknown. Sign-in uses both, for those two reasons: the
 * page assembling has a known shape and gets `SignInSkeleton`'s blocks, while a session
 * handoff does not and gets this.
 *
 * ## It never moves at the cost of the message
 *
 * `role="status"` with a `sr-only` label, so the wait is announced in words and is not
 * carried by motion or by the glyph alone. Under `prefers-reduced-motion` the
 * travelling blocks are removed and the static path stays, which still reads as working.
 */
export function InfinityTrack({
  canvas = 'dark',
  size = 'md',
  label = 'Working…',
  className,
}: InfinityTrackProps) {
  return (
    <span
      role="status"
      className={cn(INFINITY_TRACK_BASE_CLASS, SIZE_CLASS[size], 'text-current', className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 grid" style={{
        gridTemplateColumns: `repeat(${INFINITY_TRACK_COLS}, 1ch)`,
      }}>
        {INFINITY_TRACK_CELLS.map((glyph, index) => (
          <span key={index} className="flex h-[1ch] w-[1ch] items-center justify-center">
            {glyph}
          </span>
        ))}
      </span>

      {INFINITY_TRACK_BLOCKS.map((glyph, index) => (
        <span
          key={glyph}
          aria-hidden
          className={cn(
            INFINITY_TRACK_CELL_CLASS,
            INFINITY_TRACK_Z_CLASS[index],
            INFINITY_TRACK_ANIMATION_CLASS,
            MASK_CLASS[canvas]
          )}
          style={{
            animationDelay: `calc(var(--delay, 0.1s) * ${index})`,
          }}
        >
          {glyph}
        </span>
      ))}

      <span className="sr-only">{label}</span>
    </span>
  );
}
