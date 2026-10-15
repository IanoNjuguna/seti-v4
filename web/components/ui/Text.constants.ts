import type { TextColor, TextVariant } from './Text.types';

/**
 * Type scale from `design/revolut.md` §Typography. **No colour lives here.**
 *
 * A variant used to bake its own colour in (`micro` → `text-stone`). `cn()` is a
 * plain join, not `twMerge`, so `variant="micro" color="alert"` emitted BOTH
 * `text-stone` and `text-accent-danger` and Tailwind's own ordering picked the
 * winner — it emits colour utilities alphabetically, so the baked `text-stone`
 * landed after `text-accent-danger` and won. The alert colour rendered grey, and
 * every caller that wanted a colour paid for it.
 *
 * Colour is now resolved to exactly ONE class (`DEFAULT_COLOR_CLASSES` below, and
 * `Text`): the caller's `color` when given, the variant's own otherwise. A single
 * class cannot lose to another, so the result is decided by the code, not by
 * emission order.
 */
export const VARIANT_CLASSES: Record<TextVariant, string> = {
  // 40px / 1.2 / -0.4px on desktop, 24px on phones. A 320px viewport leaves ~181px
  // of card, which 32px text overflows for a compact 8-char amount, so the number
  // broke mid-value — the one thing a balance must never do.
  balance: 'font-brand font-medium text-heading-md sm:text-display-md',
  // The same figure, one step down per length. A balance must never be rounded and must
  // never wrap mid-value, so the SIZE gives way as the number grows: the amount stays
  // exactly what the ledger says, and the type shrinks to fit it.
  'balance-compact': 'font-brand font-medium text-heading-sm sm:text-heading-md',
  'balance-tight': 'font-brand font-medium text-heading-sm',
  // 20px / 1.4 / 500 — list headers ("Recent activity").
  section: 'font-brand font-medium text-heading-sm',
  // 16px / 600 / 0.16px — body-md-bold, the emphatic row title.
  'card-title': 'text-body-md-bold',
  body: 'text-body-md',
  'body-medium': 'text-body-md-bold',
  // 14px / 400 / 1.43 — captions and metadata.
  micro: 'text-body-sm',
  button: 'text-button',
  // 14px / 600 / 1.43 — button-sm, the pill-chip label.
  tab: 'text-body-sm font-semibold',
};

/**
 * The colour a variant falls back to when the caller passes no `color`.
 *
 * These are exactly the colours the variants used to carry, so a `variant`-only
 * call renders identically — but now as a SINGLE class that an explicit `color`
 * replaces outright instead of competing with. `tab` never set a colour (it
 * inherits from its parent), so it declares none here.
 */
export const DEFAULT_COLOR_CLASSES: Record<TextVariant, string> = {
  balance: 'text-ink',
  'balance-compact': 'text-ink',
  'balance-tight': 'text-ink',
  section: 'text-ink',
  'card-title': 'text-ink',
  body: 'text-ink',
  'body-medium': 'text-ink',
  micro: 'text-stone',
  button: 'text-canvas-dark',
  tab: '',
};

/**
 * Text roles, not hues: the doc reserves colour by *purpose*.
 *
 * `accent` is the cobalt brand colour (links, featured states); a routine action
 * never uses it. `success` / `warning` / `alert` are the doc's reserved status
 * accents (`accent-light-green` / `accent-yellow` / `accent-danger`) exposed as
 * roles, so a status word names its purpose and never has to hand-copy a token
 * class — which is how the colour-order defect used to get worked around.
 */
export const COLOR_CLASSES: Record<TextColor, string> = {
  primary: 'text-ink',
  secondary: 'text-mute',
  inverse: 'text-on-dark',
  // `on-dark-mute` — the doc's secondary text inside dark regions (nav labels).
  'inverse-muted': 'text-on-dark-mute',
  accent: 'text-primary',
  success: 'text-accent-light-green',
  warning: 'text-accent-yellow',
  // The doc's warning orange, used where the app marks a STATE rather than a
  // problem — the practice marks on the frame and the rail.
  attention: 'text-accent-warning',
  alert: 'text-accent-danger',
};
