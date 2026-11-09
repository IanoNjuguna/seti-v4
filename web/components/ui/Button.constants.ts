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
 *  - `ghost`       → an inline link, which the doc sets in `{colors.link}`. It carries NO box: no
 *                    fill, no border, no padding, no fixed height beyond the 44px tap target. A ghost
 *                    button with a rectangle around it is a secondary button with less contrast (#491).
 *  - `destructive` → red INK, not a red slab. `design/revolut.md` puts a destructive action in a row
 *                    with red type; a 48px red rectangle outranks the commit beside it, which inverts the
 *                    hierarchy the screen is trying to state (#491).
 *  - `pill`        → a PRESET chip (`button-pill-sm`), unfilled with a hairline, chosen state by
 *                    `data-selected`. It must not read as a small button: a chip selects a value, and a
 *                    control that looks like a button invites a second action (#491).
 *
 * Focus rings use the cobalt accent because it is the system's focus/emphasis
 * colour; the doc has no dedicated focus token.
 */
export const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'ctl-raised ctl-raised-dark bg-canvas-dark text-on-dark hover:bg-charcoal rounded-md min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-[background-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  secondary:
    'bg-canvas-light text-ink border border-hairline-strong hover:bg-surface-soft rounded-md min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-colors duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  ghost:
    'bg-transparent text-link hover:text-primary-deep underline-offset-4 hover:underline min-touch h-11 px-0 inline-flex items-center justify-center font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  destructive:
    'bg-transparent text-accent-danger hover:text-accent-deep-red min-touch h-11 px-0 inline-flex items-center justify-center font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  pill: 'bg-transparent text-ink border border-hairline-light hover:border-hairline-strong hover:bg-surface-soft rounded-md h-9 px-4 inline-flex items-center justify-center text-sm font-semibold transition-colors duration-200 data-[selected=true]:border-ink data-[selected=true]:bg-surface-soft',
  /*
   * The money submit, and the only yellow control in the app.
   *
   * Yellow is a FILL and nothing else: `#d7cf07` measures 1.64:1 against
   * `canvas-light`, so it is unreadable as type and invisible as an edge on a
   * white band — hence the 1px `ink` border, the boundary WCAG 1.4.11 asks of a
   * control that would otherwise have none. The label is `ink` (10.44:1); white
   * (1.64:1) and cobalt (3.70:1) both fail on it.
   *
   * The focus ring is `ink`, not the system's cobalt: a ring is a boundary
   * against the fill, and a yellow fill inside a cobalt ring reads as a smudge.
   * Hover steps the fill down one notch (`accent-lime-deep`) so the label colour
   * never has to change. Disabled goes grey, never a dimmed yellow.
   */
  accent:
    'ctl-raised ctl-raised-accent bg-accent-lime text-ink border border-ink hover:bg-accent-lime-deep rounded-md min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-[background-color,box-shadow,transform] duration-(--duration-quick) ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:bg-surface-soft disabled:text-stone disabled:border-hairline-light',
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
  accent: 'button',
  'on-dark': 'button',
  'outline-dark': 'button',
  'destructive-soft': 'button',
};

/** Label colour per variant — white on the black pill, ink on the white ones. */
export const TEXT_COLOR: Record<ButtonVariant, 'inverse' | 'primary' | 'accent' | 'alert'> = {
  primary: 'inverse',
  secondary: 'primary',
  ghost: 'accent',
  /*
   * RED, not white (#491). The fill is gone, so a white label on a transparent button is a label on the
   * page background: it rendered invisible, and a destructive action nobody can see is worse than none.
   * The role follows the ink the variant declares.
   */
  destructive: 'alert',
  pill: 'primary',
  /* Ink label on the white CTA (the doc's `canvas-dark` is a hair darker than
     `ink`; the system's own text colour is the right token for a label). */
  'on-dark': 'primary',
  'outline-dark': 'inverse',
  /* The `alert` ROLE on a soft surface: the doc's inline error red, taken one
     step to the text grade so it is legible on `surface-soft`. */
  'destructive-soft': 'alert',
  /* Ink on the yellow: the only label that clears AA against that fill. */
  accent: 'primary',
};
