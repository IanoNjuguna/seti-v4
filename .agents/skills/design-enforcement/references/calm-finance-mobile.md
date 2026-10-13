# Calm Finance — mobile only, until it migrates

Source of truth: `DESIGN.md` at the repository root. Governs `mobile/` (React Native /
Expo) **only**. The repo's target system is the Revolut one (`design/revolut.md`,
see `revolut-web.md`); mobile has not migrated yet, so these tokens are still correct
here and must not be "fixed" to match web.

## Core philosophy

- "Financial clarity without cognitive overload."
- No exclamation marks, no gamification, no flashy gradients, no aggressive upsells.
- Direct, reassuring, transparent, quiet copy.
- Every screen answers one question: "What do I do here?"

## Tokens & Colour

- Semantic/token classes only. Never raw hex in a component.
- Required semantic tokens:
  - `color-bg-canvas`, `color-surface-card`, `color-surface-inset`
  - `color-border-1`, `color-border-focus`
  - `color-text-primary`, `color-text-secondary`, `color-text-inverse`
  - `color-accent-primary`, `color-accent-hover`, `color-alert`, `color-success-bg`
- Every surface/text pair must have a dark-mode equivalent.
- All body text must meet 4.5:1 contrast on its background.

## Typography

- Type scale tokens: `text-balance`, `text-section`, `text-card-title`, `text-body`,
  `text-body-medium`, `text-micro`, `text-button`, `text-tab`.
- `font-tabular` on every monetary value.

## Shape & Surface

- Radii: `radius-input` = 12px (buttons, inputs, small pills) · `radius-card` = 16px
  (cards, panels, lists) · `radius-pill` = 9999px (badges, quick pills)
  · `radius-sheet` = 24px top (bottom sheets).
- Shadows: `shadow-ambient` only; no heavy drop shadows.
- Default card border: `1px solid color-border-1`.

## Components

- Compose from `components/ui/` primitives (Button, Input, Card, Sheet, Badge,
  TransactionRow, AmountInput) before writing custom markup.
- Buttons:
  - Primary: `bg-accent-primary text-inverse radius-input h-12`
  - Secondary: `bg-surface-card text-primary border border-1 radius-input`
  - Ghost: transparent + `text-accent-primary`
  - Destructive: `bg-alert text-inverse`
  - Quick Pill: `bg-surface-inset text-secondary radius-pill h-8`
- Loading buttons show a spinner and set `disabled`.
- Inputs: label above, 48px height, `bg-surface-inset`, focused `border-border-focus`,
  error `border-alert`.
- Bottom sheets: drag handle, backdrop blur, snap points, focus trap, close on
  backdrop tap.
- Transaction rows: 64px height, merchant `text-card-title`, amount
  `text-body-medium font-tabular`.
- Navigation: bottom tab bar, 4 tabs, min 44×44 pt per tab.

## Layout & Motion

- Mobile-first. Default outer screen padding: 20px. Card internal padding: 16px.
- Touch targets minimum 44×44 pt.
- Motion: press `scale(0.98)` 120ms, transitions 200ms ease-out, sheets 300ms spring.
- Respect reduced motion.
- Use `SafeAreaView`, status-bar handling, and keyboard-avoiding views on forms.

## Engineering guardrails (mobile)

- No web assumptions: no `next/image`, no `next/link`, no SSR.
- Verify dependencies in `package.json` before adding new packages.
- Every async surface needs loading, empty, and error states with skeletons matching
  layout shape.
- `accessibilityLabel` on every icon-only button; screen-reader hints for masked data.
- Semantic structure: prefer meaningful wrappers over nested `<View>` soup.
- Do not rely on colour alone for status — pair with text + icon.

## Copy & tone

- Plain, specific, contextual. No AI clichés.
- CTA labels: 2–4 words max. Examples: `Send`, `Add Money`, `Pay`, `Cancel`.
- Insights: one sentence max. Example: "You spent 12% less on dining this week."
- Success: "Sent KES 1,250.00 to Alice."
- Error: "Couldn't send. Check your balance and try again."
