import type { ButtonVariant } from '@/lib/types';

/**
 * Button recipes from `design/revolut.md` §Components → Buttons.
 *
 * Every button is a full pill, 48px tall, padding 14px 28px, label in
 * `text-button` (16/600/0.24px). The mapping to this app's variants:
 *
 *  - `primary`     → `button-dark`: black pill, white label. On a white band the
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
    'bg-canvas-dark text-on-dark hover:bg-charcoal rounded-full min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-colors duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  secondary:
    'bg-canvas-light text-ink border border-hairline-strong hover:bg-surface-soft rounded-full min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-colors duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  ghost:
    'bg-transparent text-link hover:text-primary-deep rounded-full min-touch h-12 px-2 inline-flex items-center justify-center font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  destructive:
    'bg-accent-danger text-on-dark hover:bg-accent-deep-red rounded-full min-touch h-12 px-7 inline-flex items-center justify-center font-semibold transition-colors duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  pill: 'bg-surface-soft text-ink hover:bg-faint rounded-full h-9 px-4 inline-flex items-center justify-center font-semibold transition-colors duration-200 active:scale-[0.98]',
};

export const TEXT_VARIANT: Record<ButtonVariant, 'button' | 'tab'> = {
  primary: 'button',
  secondary: 'button',
  ghost: 'button',
  destructive: 'button',
  pill: 'tab',
};

/** Label colour per variant — white on the black pill, ink on the white ones. */
export const TEXT_COLOR: Record<ButtonVariant, 'inverse' | 'primary' | 'accent'> = {
  primary: 'inverse',
  secondary: 'primary',
  ghost: 'accent',
  destructive: 'inverse',
  pill: 'primary',
};
