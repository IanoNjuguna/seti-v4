import type { MASK_CLASS, SIZE_CLASS } from './InfinityTrack.constants';

/** The surface under the track. Drives the mask, never the ink. */
export type InfinityTrackCanvas = keyof typeof MASK_CLASS;

/** How large the glyph renders. The path scales with the font size, in `ch`. */
export type InfinityTrackSize = keyof typeof SIZE_CLASS;

export interface InfinityTrackProps {
  /** The surface it is drawn on: `dark` (default), `light`, or the raised `elevated`. */
  canvas?: InfinityTrackCanvas;
  /** `md` unless given. `lg` is for a full-screen wait, `sm` for a line of status. */
  size?: InfinityTrackSize;
  /**
   * What a screen reader is told. The track is announced as a `status`, so this is the
   * sentence it says; it defaults to the word this product uses for a wait.
   */
  label?: string;
  className?: string;
}
