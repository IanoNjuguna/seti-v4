import type { LandingRow } from './Landing.types';

/**
 * Which refusal a row is.
 *
 * A stable id rather than a position: `check:refusals` names the three by this
 * string, so a row cannot be reordered, swapped for a different refusal, or
 * quietly dropped while the check still passes. Adding a fourth refusal means
 * naming it here and in the constants, and the heading that says "Three" has to
 * move with it.
 */
export type RefusalId = 'custody' | 'account' | 'fiat';

/**
 * One thing Seti will not do: the refusal in the first line, the fact behind it
 * in the second. Same label/detail shape as the other bands' rows, so the band
 * is the page's rhythm rather than a new piece of furniture.
 */
export interface RefusalRow extends LandingRow {
  id: RefusalId;
}
