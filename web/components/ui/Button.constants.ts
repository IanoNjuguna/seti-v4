import type { ButtonVariant } from '@/lib/types';

/**
 * Button recipes from `design/revolut.md` §Components → Buttons.
 *
 * Every button is `rounded-md` (12px), 48px tall, padding 14px 28px, label in
 * `text-button` (16/600/0.24px). The mapping to this app's variants:
 *
 * `primary`     → `button-dark`: black button, white label. On a white band the
 *                    black button IS the primary CTA; cobalt is reserved.
 *  - `secondary`   → `button-outline-light`: white, ink label, 1px hairline-strong.
 *  - `ghost`       → an inline link, which the doc sets in `{colors.link}`.
 *  - `destructive` → `accent-danger` fill.
 *  - `pill`        → `button-pill-sm`: 36px, `surface-soft`, ink label.
 *
 * Focus rings use the cobalt accent because it is the system's focus/emphasis
 * colour; the doc has no dedicated focus token.
 */
export const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-canvas-dark text-on-dark hover:bg-charcoal rounded-md min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-colors duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  secondary:
    'bg-canvas-light text-ink border border-hairline-strong hover:bg-surface-soft rounded-md min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-colors duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  ghost:
    'bg-transparent text-link hover:text-primary-deep rounded-md min-touch h-12 px-2 inline-flex items-center justify-center font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  destructive:
    'bg-accent-danger text-on-dark hover:bg-accent-deep-red rounded-md min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-colors duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  pill: 'bg-surface-soft text-ink hover:bg-faint rounded-md h-9 px-4 inline-flex items-center justify-center font-semibold transition-colors duration-200 active:scale-[0.98]',
  /*
   * `button-primary` — white CTA on a dark band. The brand's loudest action per
   * `design/revolut.md`, and previously inexpressible: a caller could not reach
   * it through `primary` (which is `button-dark`, for white bands) and could not
   * patch it with a class either, because `cn()` joins rather than merges and
   * the primitive's own background would win.
   *
   * Durations and easings come from `design/motion.md`'s tokens; the older
   * variants above still carry the literal `duration-200` they were written
   * with, and are left alone here rather than redesigned in passing.
   */
  'on-dark':
    'bg-canvas-light text-canvas-dark hover:bg-faint rounded-md min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-colors duration-(--duration-quick) ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark',
  /* `button-outline-dark` — the paired secondary on the same band. The doc sets
     this outline at 1px `{colors.on-dark}` on the dark canvas, not a 12%
     hairline: at 12% the box all but disappeared beside the white CTA (visible
     in the round-3 render). Hover is the motion spec's own hover — the hairline
     brightens — which here means the surface lifts to `surface-elevated`. */
  'outline-dark':
    'bg-transparent text-on-dark border border-on-dark hover:bg-surface-elevated rounded-md min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-colors duration-(--duration-quick) ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark',
  /*
   * `button-soft` with the destructive TEXT role.
   *
   * The doc keeps two reds apart: `accent-danger` is the destructive STATE (a
   * fill, chosen to read on black) and `accent-deep-red` is "inline error text".
   * Sign out is not an error and not a state badge, so the loud red FILL
   * (`destructive`) is the wrong tool on a white settings list: it becomes the
   * brightest object on a page whose subject is a person. A soft pill with the
   * text-grade red says "this ends the session" without taking the page.
   *
   * The colour is the `alert` ROLE, not a raw accent: `text-ink-alert` resolves
   * per canvas (`#8b0000` on white), which `npm run check:ink` measures.
   */
  'destructive-soft':
    'bg-surface-soft hover:bg-faint rounded-md min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-colors duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
};

export const TEXT_VARIANT: Record<ButtonVariant, 'button' | 'tab'> = {
  primary: 'button',
  secondary: 'button',
  ghost: 'button',
  destructive: 'button',
  pill: 'tab',
  'on-dark': 'button',
  'outline-dark': 'button',
  'destructive-soft': 'button',
};

/** Label colour per variant — white on the black pill, ink on the white ones. */
export const TEXT_COLOR: Record<ButtonVariant, 'inverse' | 'primary' | 'accent' | 'alert'> = {
  primary: 'inverse',
  secondary: 'primary',
  ghost: 'accent',
  destructive: 'inverse',
  pill: 'primary',
  /* Ink label on the white CTA (the doc's `canvas-dark` is a hair darker than
     `ink`; the system's own text colour is the right token for a label). */
  'on-dark': 'primary',
  'outline-dark': 'inverse',
  /* The `alert` ROLE on a soft surface: the doc's inline error red, taken one
     step to the text grade so it is legible on `surface-soft`. */
  'destructive-soft': 'alert',
};
