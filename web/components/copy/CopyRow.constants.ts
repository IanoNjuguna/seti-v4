import type { CopyRowSurface } from './CopyRow.types';

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
 */
export const VALUE_CLASSES: Record<'quiet' | 'loud', Record<CopyRowSurface, string>> = {
  quiet: { light: 'text-body-sm text-mute', dark: 'text-body-sm text-on-dark-mute' },
  loud: { light: 'text-body-md-bold text-ink', dark: 'text-body-md-bold text-on-dark' },
};
