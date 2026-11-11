/**
 * The comet spinner's two animations, and the dials they read.
 *
 * The indicator is one element: an empty circle whose `box-shadow` carries four offset copies of
 * itself, each a little larger than the last. Rotating the circle while the offsets swing from the
 * top of the orbit to the leading edge and back is what makes the copies read as a TRAIL, so the
 * whole thing is two keyframe tracks on one span and no extra DOM.
 *
 * The numbers are the supplied reference's, kept as they were: the offsets are multiples of the
 * orbit radius and the trail's taper, so the shape stays right at any size — `cqmin` units make
 * both dials fractions of the spinner's own box (`container-type: size` on the element itself).
 *
 * Named `seti-comet-*` rather than the reference's `loading-ui-*`: these are global keyframe names
 * in the document, and a generic name is one a future dependency can collide with.
 */
export const COMET_SPINNER_SHADOW_ANIMATION = 'seti-comet-shadow';
export const COMET_SPINNER_ROTATION_ANIMATION = 'seti-comet-rotation';

/** The one length of the loop, and the easing every frame shares. */
export const COMET_SPINNER_DURATION = '1.7s';

/**
 * The keyframes, verbatim from the reference.
 *
 * `0%`, `5%–95%` and `100%` are the trail collapsed behind the head (a full circle); `10%–59%` and
 * the two following stops are the trail fanning out ahead of it. Written as a template literal in
 * one place because they are one animation: splitting them per keyframe would let a stop go missing
 * and leave the comet lopsided.
 */
export const COMET_SPINNER_KEYFRAMES = `
@keyframes ${COMET_SPINNER_SHADOW_ANIMATION} {
  0% {
    box-shadow:
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.1),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.2),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.3),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.385);
  }

  5%,
  95% {
    box-shadow:
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.1),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.2),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.3),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.385);
  }

  10%,
  59% {
    box-shadow:
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2),
      calc(var(--loading-ui-comet-radius) * -0.105) calc(var(--loading-ui-comet-radius) * -0.994) 0 calc(var(--loading-ui-comet-head) * -2.1),
      calc(var(--loading-ui-comet-radius) * -0.208) calc(var(--loading-ui-comet-radius) * -0.978) 0 calc(var(--loading-ui-comet-head) * -2.2),
      calc(var(--loading-ui-comet-radius) * -0.308) calc(var(--loading-ui-comet-radius) * -0.95) 0 calc(var(--loading-ui-comet-head) * -2.3),
      calc(var(--loading-ui-comet-radius) * -0.358) calc(var(--loading-ui-comet-radius) * -0.934) 0 calc(var(--loading-ui-comet-head) * -2.385);
  }

  20% {
    box-shadow:
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2),
      calc(var(--loading-ui-comet-radius) * -0.407) calc(var(--loading-ui-comet-radius) * -0.913) 0 calc(var(--loading-ui-comet-head) * -2.1),
      calc(var(--loading-ui-comet-radius) * -0.669) calc(var(--loading-ui-comet-radius) * -0.743) 0 calc(var(--loading-ui-comet-head) * -2.2),
      calc(var(--loading-ui-comet-radius) * -0.808) calc(var(--loading-ui-comet-radius) * -0.588) 0 calc(var(--loading-ui-comet-head) * -2.3),
      calc(var(--loading-ui-comet-radius) * -0.902) calc(var(--loading-ui-comet-radius) * -0.41) 0 calc(var(--loading-ui-comet-head) * -2.385);
  }

  38% {
    box-shadow:
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2),
      calc(var(--loading-ui-comet-radius) * -0.454) calc(var(--loading-ui-comet-radius) * -0.892) 0 calc(var(--loading-ui-comet-head) * -2.1),
      calc(var(--loading-ui-comet-radius) * -0.777) calc(var(--loading-ui-comet-radius) * -0.629) 0 calc(var(--loading-ui-comet-head) * -2.2),
      calc(var(--loading-ui-comet-radius) * -0.934) calc(var(--loading-ui-comet-radius) * -0.358) 0 calc(var(--loading-ui-comet-head) * -2.3),
      calc(var(--loading-ui-comet-radius) * -0.988) calc(var(--loading-ui-comet-radius) * -0.108) 0 calc(var(--loading-ui-comet-head) * -2.385);
  }

  100% {
    box-shadow:
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.1),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.2),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.3),
      0 calc(var(--loading-ui-comet-radius) * -1) 0 calc(var(--loading-ui-comet-head) * -2.385);
  }
}

@keyframes ${COMET_SPINNER_ROTATION_ANIMATION} {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
`;

/** The dials' defaults and their legal range, in the order the reference clamps them. */
export const COMET_SPINNER_DEFAULT_HEAD_SCALE = 0.2;
export const COMET_SPINNER_DEFAULT_RADIUS_SCALE = 0.83;
export const COMET_SPINNER_HEAD_SCALE_RANGE = [0.08, 0.35] as const;
export const COMET_SPINNER_RADIUS_SCALE_RANGE = [0.3, 1.1] as const;

/** The label every instance announces. One spinner, one word. */
export const COMET_SPINNER_LABEL = 'Loading';
