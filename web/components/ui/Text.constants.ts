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
  balance: 'font-mono font-medium text-heading-md sm:text-display-md',
  // The same figure, one step down per length. A balance must never be rounded and must
  // never wrap mid-value, so the SIZE gives way as the number grows: the amount stays
  // exactly what the ledger says, and the type shrinks to fit it.
  'balance-compact': 'font-mono font-medium text-heading-sm sm:text-heading-md',
  'balance-tight': 'font-mono font-medium text-heading-sm',
  // 24px / 1.33 / 500 — `heading-md`, the size a lockup or panel title uses. Added
  // when the rail's wordmark asked for `heading-md` on top of `section` (20px): a
  // second size class cannot win there. Tailwind emits a FIXED order for these
  // utilities that is neither the `@theme` order nor the call order, and
  // `text-heading-sm` is emitted last of the family (verified twice in the compiled
  // sheet: `.text-heading-md` at 8146, `.text-heading-sm` at 8234 of one compile),
  // so `section`'s own size beat the class beside it. Two sizes in one join resolve
  // by emission order, not by intent; one variant per size cannot. Same fix as
  // `body-md-bold` above.
  'heading-md': 'font-brand font-medium text-heading-md',
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
  'heading-md': 'text-ink',
  section: 'text-ink',
  'card-title': 'text-ink',
  body: 'text-ink',
  'body-medium': 'text-ink',
  // `ash`, not `stone`. Every variant above defaults to a colour that clears AA
  // on the surface it is drawn on; `micro` alone defaulted to `stone`
  // (#8d969e), which is 3.0:1 on white and 2.7:1 on `surface-soft`. That made
  // the QUIETEST-looking default the one that failed: three files in this app
  // cite the ratio as the reason they hand-pick a colour instead of taking the
  // default (`ClaimFormHeader`, `IntentOption`, `SendProgress`), which is a
  // default every careful caller has to work around. `ash` (#5c5e60) is the
  // palette's own next step down the SAME neutral family as `stone` and is
  // 6.5:1 on white, 5.9:1 on `surface-soft`, still the lightest ink a caption
  // may use, now legible. `stone` remains for what it is actually for: rules,
  // separators and disabled foreground.
  micro: 'text-ash',
  button: 'text-canvas-dark',
  tab: '',
};

/**
 * Text roles, not hues: the doc reserves colour by *purpose*.
 *
 * `accent` is the cobalt brand colour (links, featured states); a routine action
 * never uses it. `success` / `warning` / `alert` are the doc's reserved status
 * accents exposed as roles, so a status word names its purpose and never has to
 * hand-copy a token class — which is how the colour-order defect used to get
 * worked around.
 *
 * THE STATUS ROLES NAME INK TOKENS, NOT FILL TOKENS, and those tokens resolve
 * per canvas (`--color-ink-*` in `app/globals.css`). That split is the fix for
 * three of the app's text colours being below AA: the roles used to point
 * straight at the accents (`accent-danger`, `accent-yellow`, `accent-warning`),
 * which are the colours the doc reserves for illustrations, chrome and fills and
 * which READ ON BLACK, so as text on a white band they measured 4.24:1,
 * 3.07:1 and 2.78:1. `design/revolut.md` already names the pattern
 * (`accent-deep-red` is "inline error text", `accent-danger` the error state),
 * and the same pair exists for success (`accent-green-text`); the roles now use
 * the text-grade step on white and keep the fill accent inside a dark canvas,
 * where the receipt draws two of them. Every fill, border and icon in the app
 * still names the accent itself and is unchanged.
 */
export const COLOR_CLASSES: Record<TextColor, string> = {
  primary: 'text-ink',
  secondary: 'text-mute',
  inverse: 'text-on-dark',
  // `on-dark-mute` — the doc's secondary text inside dark regions (nav labels).
  'inverse-muted': 'text-on-dark-mute',
  accent: 'text-primary',
  success: 'text-ink-success',
  warning: 'text-ink-warning',
  // The doc's warning orange, used where the app marks a STATE rather than a
  // problem — the practice marks on the frame and the rail. It takes its
  // text-grade step on a white canvas and stays `accent-warning` on the black
  // chrome it was chosen for (7.6:1 there), so the marker is legible on either.
  attention: 'text-ink-attention',
  alert: 'text-ink-alert',
};
