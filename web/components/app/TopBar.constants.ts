/**
 * The bar's three controls and the words the screen reader hears (#592).
 *
 * A control with no visible label needs a name, and the name is not decoration: it is the
 * only thing telling someone what a bell in the corner of a money app opens. All three are
 * 44px targets, which is why their size is a token here rather than a class in each call site.
 */

/**
 * Support is a `mailto:` while it is one route with no screen behind it (#592).
 *
 * The address is the one already printed on seti.live, so a customer who taps it lands in a
 * mail app with the right recipient — no form, no ticket number, nothing to sign up for.
 */
export const SUPPORT_HREF = 'mailto:hey@seti.live';

export const TOP_BAR_COPY = {
  notifications: 'Notifications',
  support: 'Email support',
} as const;

/**
 * The target every control in the bar shares.
 *
 * Written once because three separate `h-11 w-11` strings are three chances for one of them
 * to drift to 40px, and the platform guidance has no exception for a corner.
 */
export const BAR_TARGET = 'flex h-11 w-11 items-center justify-center rounded-full';

/** The hover, focus and disabled treatment the three controls share. */
export const BAR_CONTROL =
  'text-inverse transition-colors duration-(--duration-quick) ease-out hover:bg-surface-deep hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark';
