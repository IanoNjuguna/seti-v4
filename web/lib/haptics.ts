/**
 * A short pulse, where the device can produce one.
 *
 * The moment the quote lands is the moment the customer should feel — it is the
 * point where the figure they are about to approve stops moving and becomes the
 * thing they are agreeing to. A pulse marks it without adding a clock or a spinner.
 *
 * Progressive enhancement, never a dependency. Most desktop browsers and every iOS
 * browser ignore `navigator.vibrate`, so the call is fired and its absence is silent
 * — Android Chrome is where it is felt today. Callers must NEVER gate behaviour on
 * it: nothing in the flow may depend on the pulse having happened, and it must never
 * throw. When the mobile app returns, this is the one place to swap in expo-haptics,
 * so the moment stays defined once.
 */

/**
 * Default pattern: one short tap.
 *
 * Deliberately short. This marks an arrival, not an alarm — a long buzz on a quote
 * reads as an error, and there is nothing wrong.
 */
const PULSE = 12;

export function pulse(pattern: number | number[] = PULSE): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return;
    }

    navigator.vibrate(pattern);
  } catch {
    // A blocked or unsupported pulse is not worth surfacing to anyone: the quote is
    // on screen either way.
  }
}
