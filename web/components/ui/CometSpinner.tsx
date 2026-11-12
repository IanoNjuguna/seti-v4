import { cn } from '@/lib/cn';
import {
  COMET_SPINNER_DEFAULT_HEAD_SCALE,
  COMET_SPINNER_DEFAULT_RADIUS_SCALE,
  COMET_SPINNER_DURATION,
  COMET_SPINNER_HEAD_SCALE_RANGE,
  COMET_SPINNER_KEYFRAMES,
  COMET_SPINNER_LABEL,
  COMET_SPINNER_RADIUS_SCALE_RANGE,
  COMET_SPINNER_ROTATION_ANIMATION,
  COMET_SPINNER_SHADOW_ANIMATION,
} from './CometSpinner.constants';
import type { CometSpinnerProps, CometSpinnerVars } from './CometSpinner.types';

/**
 * One dot going round with a tail behind it — the app's indeterminate loader.
 *
 * It replaces the sign-in skeleton's track (#567) for one reason: a wait this short does not need
 * the shape of the page that is coming, it needs a thing that is OBVIOUSLY working. The trail is
 * drawn as four offset `box-shadow` copies of one circle, so there is no second element, no SVG and
 * nothing to keep in sync — the circle rotates and the shadows swing, and the two together are the
 * comet.
 *
 * The box is `container-type: size`, and the two dials are `cqmin` fractions of it, which is what
 * lets the same component be a 20px inline indicator or a 96px empty state at the same proportions.
 * `headScale` and `radiusScale` are clamped rather than trusted: a caller passing `0` would collapse
 * the trail into nothing and read as a stalled spinner.
 *
 * `role="status"` and an sr-only label, so a screen reader hears "Loading" once; the visual is
 * `aria-hidden`.
 */
export function CometSpinner({
  className,
  style,
  headScale = COMET_SPINNER_DEFAULT_HEAD_SCALE,
  radiusScale = COMET_SPINNER_DEFAULT_RADIUS_SCALE,
  ...props
}: CometSpinnerProps) {
  const [headMin, headMax] = COMET_SPINNER_HEAD_SCALE_RANGE;
  const [radiusMin, radiusMax] = COMET_SPINNER_RADIUS_SCALE_RANGE;
  const safeHeadScale = Math.min(Math.max(headScale, headMin), headMax);
  const safeRadiusScale = Math.min(Math.max(radiusScale, radiusMin), radiusMax);

  const cometStyle = {
    ...style,
    containerType: 'size',
    '--loading-ui-comet-head': `${(safeHeadScale * 100).toFixed(2)}cqmin`,
    '--loading-ui-comet-radius': `${(safeRadiusScale * 100).toFixed(2)}cqmin`,
  } as CometSpinnerVars;

  return (
    <>
      <style>{COMET_SPINNER_KEYFRAMES}</style>
      <span
        role="status"
        aria-label={COMET_SPINNER_LABEL}
        className={cn('relative inline-flex aspect-square items-center justify-center align-middle', className)}
        style={cometStyle}
        {...props}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            animation: `${COMET_SPINNER_SHADOW_ANIMATION} ${COMET_SPINNER_DURATION} infinite ease, ${COMET_SPINNER_ROTATION_ANIMATION} ${COMET_SPINNER_DURATION} infinite ease`,
            transform: 'translateZ(0)',
          }}
        />
        <span className="sr-only">{COMET_SPINNER_LABEL}</span>
      </span>
    </>
  );
}
