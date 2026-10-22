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
