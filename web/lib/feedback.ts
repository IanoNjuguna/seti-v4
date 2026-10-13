/**
 * The moments worth marking, defined once.
 *
 * Two primitives — a haptic pulse and a synthesised note — composed at one call site so
 * the moment is named in a single place instead of being re-derived at each caller. If
 * the moment needs a different treatment later (a visual settle for desktop, a warmer
 * voice for a completed payment), this is the file that changes.
 */
import { pulse } from './haptics';
import { play } from './sound';

/**
 * A quote has landed: the figure has stopped moving and is now what the customer is
 * agreeing to.
 *
 * Fires on arrival, never on a refresh — one buzz and one note per flow, not per
 * keystroke. Both are decoration: neither may be depended on, and on most desktops
 * (and every iOS browser) the pulse does nothing at all. The sound is the part that
 * carries on desktop, and the mute flag silences it.
 */
export function quoteArrived(): void {
  pulse();
  play('settle');
}
