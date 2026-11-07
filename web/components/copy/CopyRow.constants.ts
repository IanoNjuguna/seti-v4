import type { CopyRowSize, CopyRowSurface } from './CopyRow.types';

/**
 * How loud the VALUE itself reads, per surface.
 *
 * Two roles, not a colour per caller. `loud` is a value the row is about — the
 * name a sender types, the address money arrives at; `quiet` is the second half
 * of a pair, the link under the name. Both are mono: every value this row prints
 * is a string a person copies by hand when the browser blocks the clipboard, so
 * it is drawn as one.
 *
 * The classes are here rather than as a nested ternary in the component because
 * `cn()` is a plain join, not `twMerge`: a caller's `text-*` override would be
 * emitted alongside the base class and Tailwind's own order would pick the
 * winner. A role is the only way to choose one, so the roles are named once.
 *
 * SIZE and COLOUR are separate tables for the same reason. A 42-character address
 * at `body-sm` does not fit the receive page's column at 390px: it broke two
 * characters onto a second line and put the copy control beside the orphan. The
 * size is a decision about the VALUE's length, the colour is a decision about its
 * weight, and they were one class until an address needed the first without the
 * second (#419).
 */
export const VALUE_TONE: Record<'quiet' | 'loud', Record<CopyRowSurface, string>> = {
  quiet: { light: 'text-mute', dark: 'text-on-dark-mute' },
  loud: { light: 'text-ink', dark: 'text-on-dark' },
};

/** The two sizes a value is drawn at: the row's own, and one step down for a long hex. */
export const VALUE_SIZE: Record<CopyRowSize, Record<'quiet' | 'loud', string>> = {
  body: { quiet: 'text-body-sm', loud: 'text-body-md-bold' },
  caption: { quiet: 'text-caption', loud: 'text-caption font-semibold' },
};
