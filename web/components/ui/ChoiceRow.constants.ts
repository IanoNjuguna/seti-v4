/**
 * The choice row's recipe, in one place.
 *
 * A choice row is NOT a Button. Buttons are a fixed 48px with centred content, which is
 * right for a single line that acts and wrong for an option that has to explain itself:
 * the content is taller than the box and the next row's border is drawn through it. That
 * was the state of the second-factor options on a phone.
 *
 * So this recipe lets the box grow with its words and holds the text to the left edge,
 * where a list of options reads as a list. It borrows the system's own parts rather than
 * inventing any: `rounded-md`, one `hairline-strong` border, `surface-soft` on hover, the
 * cobalt focus ring, and `min-h-14` so the tap target clears 44px even with no detail line.
 */
export const CHOICE_ROW_CLASS =
  'flex w-full items-start gap-3 rounded-md border border-hairline-strong bg-canvas-light px-4 py-3.5 text-left transition-colors duration-200 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 min-h-14';

/**
 * The same row, as one line of a LIST (#545).
 *
 * A row that opens a dialog of choices is not a page of options that each act in place, and
 * inside a panel it read as a box inside a box: `option`'s ink border plus the dialog's own
 * edge plus the gap between rows said "six separate cards" where the surface is one list. So
 * the list variant carries no border and no radius, and the separators belong to the list
 * (`divide-y`), which is how every other list in the app is drawn.
 *
 * `ring-inset` because the row now reaches the panel's edge: an offset ring on a full-width
 * row paints outside the panel and clips against its radius.
 *
 * The height is FIXED rather than a minimum: a row whose mark is taller than its words (a
 * token with no balance line under it) came out 2px shorter than its neighbours, so the list
 * stepped in size — which reads as a rendering fault, not a list. One height, content centred.
 */
export const CHOICE_ROW_LIST_CLASS =
  'flex h-[4.5rem] w-full items-center gap-3 bg-canvas-light px-4 text-left transition-colors duration-200 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60';
