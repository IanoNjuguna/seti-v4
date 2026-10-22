/**
 * The mask, and the words the control wears.
 *
 * SIX DOTS, ALWAYS — never one per digit. A mask that matched the figure's length
 * would state how many digits the amount has, which is most of what someone reading
 * over a shoulder needs (the references do the same: Cash App masks every balance
 * with four dots whatever the number is).
 */
export const AMOUNT_MASK = '••••••';

/**
 * What the mask is called in the accessibility tree.
 *
 * Six bullet characters are read as "bullet bullet bullet…" otherwise, which is
 * noise that also calls attention to the fact that something is hidden in a place
 * the customer deliberately cleared.
 */
export const AMOUNT_MASK_LABEL = 'hidden';

/**
 * The control's own name. `amounts`, not `balances`: since #94 this governs the
 * month's figures and every merchant total too, and a label that under-states its
 * scope teaches the wrong thing about what is safe to show.
 */
export const AMOUNT_PRIVACY_COPY = {
  hide: 'Hide amounts',
  show: 'Show amounts',
} as const;
