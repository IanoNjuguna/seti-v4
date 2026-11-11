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

/**
 * A swap is done: signed, mined and recorded, with the row in Activity to prove it (#546).
 *
 * The double pulse is the shape a phone makes for "finished, and you can put it down" —
 * two taps rather than one, because one is what a quote already gets and this must not
 * read as the same event.
 */
export function swapCompleted(): void {
  pulse([12, 60, 12]);
  play('swapped');
}

/**
 * A swap attempt ended without one (#546).
 *
 * Fires on every path that tells the customer the swap did not happen — a refused quote,
 * a wallet failure, a record that could not be written. Never on a press the customer
 * made on purpose (`useConvertSwap` checks that before calling), because a deliberate
 * cancel is not an error and nothing went wrong.
 */
export function swapFailed(): void {
  pulse([18, 90, 18]);
  play('refused');
}
