---
name: design-enforcement
description: Enforce the Calm Finance mobile neobank design system (DESIGN.md) when writing, modifying, or reviewing UI code in the React Native / Expo app
type: prompt
whenToUse: When the user asks to write, modify, or review UI/frontend code (components, screens, styles) in this repository
---

# Design Enforcement

`DESIGN.md` at the repository root is the single source of truth for UI/UX. Read it before doing UI work. This is a **Calm Finance** system: quiet, trustworthy, modern minimalist fintech. Apply these rules to every component, screen, or style you write or review.

## Core philosophy

- “Financial clarity without cognitive overload.”
- No exclamation marks, no gamification, no flashy gradients, no aggressive upsells.
- Direct, reassuring, transparent, quiet copy.
- Every screen answers one question: “What do I do here?”

## Tokens & Color
- Use semantic/token classes only. Never introduce raw hex colors in components.
- Required semantic tokens:
  - `color-bg-canvas`, `color-surface-card`, `color-surface-inset`
  - `color-border-1`, `color-border-focus`
  - `color-text-primary`, `color-text-secondary`, `color-text-inverse`
  - `color-accent-primary`, `color-accent-hover`, `color-alert`, `color-success-bg`
- Every surface/text pair must have a dark-mode equivalent.
- All body text must meet 4.5:1 contrast on its background.

## Typography
- Use the type scale tokens: `text-balance`, `text-section`, `text-card-title`, `text-body`, `text-body-medium`, `text-micro`, `text-button`, `text-tab`.
- Apply `font-tabular` to every monetary value: hero balance, transaction amounts, amount input, numeric columns.
- Currency format: `KES 1,250.00` — symbol, space, thousands separator, two decimals.

## Shape & Surface
- Radii tokens:
  - `radius-input` = 12px (buttons, inputs, small pills)
  - `radius-card` = 16px (cards, panels, lists)
  - `radius-pill` = 9999px (badges, quick pills)
  - `radius-sheet` = 24px top (bottom sheets)
- Shadows: `shadow-ambient` only; no heavy drop shadows.
- Default card border: `1px solid color-border-1`.

## Components & Behavior
- Compose from `components/ui/` primitives (Button, Input, Card, Sheet, Badge, TransactionRow, AmountInput) before writing custom markup. Use `cn()` from the project's utility.
- Buttons:
  - Primary: `bg-accent-primary text-inverse radius-input h-12`
  - Secondary: `bg-surface-card text-primary border border-1 radius-input`
  - Ghost: transparent + `text-accent-primary`
  - Destructive: `bg-alert text-inverse`
  - Quick Pill: `bg-surface-inset text-secondary radius-pill h-8`
- Loading buttons show a spinner and set `disabled`.
- Inputs: label above, 48px height, `bg-surface-inset`, focused `border-border-focus`, error `border-alert`.
- Bottom sheets: drag handle, backdrop blur, snap points, focus trap, close on backdrop tap.
- Transaction rows: 64px height, merchant `text-card-title`, amount `text-body-medium font-tabular`.
- Navigation: bottom tab bar, 4 tabs, min 44×44 pt per tab.

## Layout & Motion
- Mobile-first. Default outer screen padding: 20px. Card internal padding: 16px.
- Touch targets minimum 44×44 pt.
- Motion: press `scale(0.98)` 120ms, transitions 200ms ease-out, sheets 300ms spring.
- Respect reduced motion.
- Use `SafeAreaView`, status-bar handling, and keyboard-avoiding views on forms.

## Engineering & UX Guardrails
- No web assumptions: no `next/image`, no `next/link`, no SSR.
- Verify dependencies in `package.json` before adding new packages.
- Every async surface needs loading, empty, and error states with skeletons matching layout shape.
- `accessibilityLabel` on every icon-only button; screen-reader hints for masked data.
- Semantic structure: prefer meaningful wrappers over nested `<View>` soup.
- Do not rely on color alone for status — pair with text + icon.

## Copy & Tone
- Plain, specific, contextual. No AI clichés.
- CTA labels: 2–4 words max. Examples: `Send`, `Add Money`, `Pay`, `Cancel`.
- Insights: one sentence max. Example: “You spent 12% less on dining this week.”
- Success: “Sent KES 1,250.00 to Alice.”
- Error: “Couldn’t send. Check your balance and try again.”

## When reviewing
Flag violations as: **[design] rule broken — file:line — expected pattern from DESIGN.md**. If code and DESIGN.md genuinely disagree, say so and propose updating DESIGN.md rather than drifting silently.
