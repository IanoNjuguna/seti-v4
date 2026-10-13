import type { TextColor, TextVariant } from './Text.types';

/**
 * Type scale from `design/revolut.md` §Typography.
 *
 * Display sizes are Aeonik Pro at weight 500 with negative tracking; Space
 * Grotesk (`font-brand`) is the loaded substitute and takes -1% tracking to
 * match the original tightness. Body and UI labels are the site's `font-sans`
 * at 400/600 with positive tracking — the "slightly mechanical" nudge the doc
 * calls for on fintech labels.
 */
export const VARIANT_CLASSES: Record<TextVariant, string> = {
  // 40px / 1.2 / -0.4px on desktop, 24px on phones. A 320px viewport leaves ~181px
  // of card, which 32px text overflows for a compact 8-char amount, so the number
  // broke mid-value — the one thing a balance must never do.
  balance: 'font-brand font-medium text-heading-md text-ink sm:text-display-md',
  // 20px / 1.4 / 500 — list headers ("Recent activity").
  section: 'font-brand font-medium text-heading-sm text-ink',
  // 16px / 600 / 0.16px — body-md-bold, the emphatic row title.
  'card-title': 'text-body-md-bold text-ink',
  body: 'text-body-md text-ink',
  'body-medium': 'text-body-md-bold text-ink',
  // 14px / 400 / 1.43 — captions and metadata.
  micro: 'text-body-sm text-stone',
  button: 'text-button text-canvas-dark',
  // 14px / 600 / 1.43 — button-sm, the pill-chip label.
  tab: 'text-body-sm font-semibold',
};

/**
 * Text roles, not hues: the doc reserves colour by *purpose*.
 * `accent` is the cobalt brand colour (links, featured states); a routine
 * action never uses it.
 */
export const COLOR_CLASSES: Record<TextColor, string> = {
  primary: 'text-ink',
  secondary: 'text-mute',
  inverse: 'text-on-dark',
  // `on-dark-mute` — the doc's secondary text inside dark regions (nav labels).
  'inverse-muted': 'text-on-dark-mute',
  accent: 'text-primary',
  alert: 'text-accent-danger',
};
