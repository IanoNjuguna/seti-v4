import type { CSSProperties, ComponentProps } from 'react';

/**
 * The comet spinner's props: a `span` plus the two dials that shape the trail.
 *
 * Both dials are SCALES of the spinner's own box, not pixel sizes, so the indicator can be dropped
 * into a 20px row or a 120px empty state and keep its proportions.
 */
export interface CometSpinnerProps extends ComponentProps<'span'> {
  /** The comet's head, as a fraction of the box. Clamped to `0.08–0.35`. */
  headScale?: number;
  /** The orbit's radius, as a fraction of the box. Clamped to `0.3–1.1`. */
  radiusScale?: number;
}

/** The two CSS variables the keyframes read. Set on the box, read by the shadow track. */
export interface CometSpinnerVars extends CSSProperties {
  '--loading-ui-comet-head': string;
  '--loading-ui-comet-radius': string;
}
