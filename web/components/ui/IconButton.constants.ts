/**
 * The geometry every round, icon-only control shares.
 *
 * A circle is the doc's shape for exactly this ("circles stay circles: avatars, status dots and
 * round icon buttons"), and 44px is the tap minimum rather than a taste call. It lives here rather
 * than inside `IconButton` because `PageBack` is the SAME control with different semantics: it is a
 * `Link`, not a `button`, so it cannot use `IconButton` and has to share its shape instead. A second
 * hand-written copy of this string is how the back control drifts five pixels from the icon button
 * beside it (#438).
 */
export const ICON_CONTROL_CLASS =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-(--duration-quick) ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100';

/** The well, per surface. The glyph is the control; the circle is what it sits in. */
export const ICON_CONTROL_SURFACE: Record<'light' | 'dark', string> = {
  light: 'bg-surface-soft hover:bg-faint',
  dark: 'bg-transparent hover:bg-surface-deep',
};
