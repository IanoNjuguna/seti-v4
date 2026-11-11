/**
 * The sign-in code as six cells: one length, one shape of state, one set of classes.
 *
 * The code the provider mails is six digits and has always been. The cell count is derived
 * from that one constant so a seven-digit product would be a number change here, not a
 * hunt through the component.
 */

export const CODE_LENGTH = 6;

/**
 * The cells' surface, and why it is the field's surface rather than a new one.
 *
 * `design/revolut.md` gives the product ONE control shape: `rounded-md` (12px), 56px
 * tall, `surface-elevated` on the dark canvas, a hairline, and the cobalt `primary` as
 * the focus border. Six small squares are six of the same control, not a new idiom, so
 * they take exactly those tokens. The reference this page follows draws them as raised
 * white tiles with no border; on our dark canvas the same quietness comes from the fill
 * being one step off the page and the hairline doing the edge, which is the system's own
 * way of saying "inset".
 */
export const CELL_BASE_CLASS =
  'h-14 min-w-0 flex-1 rounded-md border bg-surface-elevated text-center text-heading-md font-medium text-on-dark caret-transparent outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary';

/** A cell that is filled is not otherwise different: the digit is the state. */
export const CELL_EMPTY_EXTRA_CLASS = 'border-hairline-dark';

/**
 * ## A refused code does not repaint the cells
 *
 * It did, and six red boxes under a sentence that already says what went wrong is the
 * screen shouting twice: the code is the person's own input, not a faulty field, and the
 * failure block sits directly above the cells. The state survives for assistive tech
 * (`aria-invalid` in `CodeCells`) and the colour is left to the sentence that can name the
 * cause — `design-enforcement`'s rule read the other way round: colour may accompany text,
 * it may not be the loudest thing on the screen.
 */

/**
 * The row: six cells filling the column, sharing its two edges with the button below.
 *
 * `min-w-0 w-full` is not decoration: a `fieldset` is `min-inline-size: min-content` by
 * default, so six cells declared `flex-1` still refused to shrink and the row overflowed
 * the column's right edge. The group has to give the flex row permission to be exactly
 * the column's width before the cells can divide it.
 */
export const CELL_ROW_CLASS = 'flex w-full min-w-0 gap-2';

/** Screen-reader only: each cell names its position, because a lone digit names nothing. */
export const cellLabel = (index: number): string => `Digit ${index + 1} of ${CODE_LENGTH}`;

/**
 * The group's name, for the same reader. The visible heading above already asks for the
 * code; this is the label the `fieldset` needs so the six cells are one question rather
 * than six unexplained boxes.
 */
export const CODE_FIELD_LABEL = 'Sign-in code';
