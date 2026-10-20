/**
 * The sign-in page's geometry, in one place.
 *
 * ## ONE block step, 24px
 *
 * Every seam on this page is `SIGN_IN_BLOCK_STEP`: mark → headline → lede → form, and
 * the form's own controls (which use the same 24 through `gap-6`). It replaces
 * 32/20/24/20/8/20, five values with no scale behind them, which is why a single
 * column read as a stack of unrelated rows rather than as one page. A single step is
 * also what makes the seam measurable: every gap is the same number, so a regression
 * is one number that moved.
 *
 * `max-w-sm` (384px) is the column's whole argument: a front door with one field in it
 * has no second column to fill.
 */
export const SIGN_IN_COLUMN_CLASSES = 'w-full max-w-sm';

/**
 * The mark, flush left on the column's edge and 48px tall.
 *
 * Not centred (see `SignInPanel`), and not the 60px the centred emblem used: on the
 * type axis it is a masthead for a 40px headline, and a 60px mark above it competed
 * with the one line that carries the instruction.
 */
export const SIGN_IN_MARK_CLASSES = 'h-12';

/** The page's single block step — see `SIGN_IN_COLUMN_CLASSES`. */
export const SIGN_IN_BLOCK_STEP = 'mt-6';
