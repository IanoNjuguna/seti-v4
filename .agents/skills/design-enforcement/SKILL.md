---
name: design-enforcement
description: Enforce this repo's design systems for any UI work — design/revolut.md on every web surface, Calm Finance (DESIGN.md) on mobile until it migrates
type: prompt
whenToUse: When the user asks to write, modify, or review UI/frontend code (components, screens, styles) on any surface — web (Next.js) or mobile (React Native / Expo)
---

# Design Enforcement

Two systems are in play and **the surface decides which one governs**. Route before you
style: applying the wrong one re-paints an entire surface, and the token names collide,
so a mixed recipe renders unstyled.

| Surface | Source of truth | Status |
| --- | --- | --- |
| `web/` — landing page (`web/app/page.tsx`) and the product app (`web/app/app/*`, served at `/app`) | `design/revolut.md` | **in force** |
| `mobile/` — React Native / Expo app | `DESIGN.md` (Calm Finance) | **legacy — the repo target is the Revolut system; mobile migrates later** |

Per-surface detail (load the one you need):

- `references/revolut-web.md` — web vocabulary: tokens, the no-shadow rule, pill geometry,
  black-on-white primary CTA, the gotchas already paid for.
- `references/calm-finance-mobile.md` — the Calm tokens, type scale, shape and component
  recipes still governing `mobile/`.

Rules for the migration window:

- Keep `mobile/` Calm. Its tokens are correct *there*; do not "fix" them to match web.
- Any **new** work on a web surface uses the Revolut system.
- Never mix the two vocabularies on one surface. If you find a Calm token on a web
  surface (or vice versa), that is a real defect, not a style preference — flag it.
- Mobile migration is not a drive-by: it is one deliberate pass, per surface.

## Invariants (both surfaces)

- Semantic tokens only. Never raw hex in a component.
- Compose from the shared primitives (`components/ui/`) before writing custom markup;
  use the project's `cn()` utility.
- `font-tabular` on every monetary value.
- Currency format: `KES 1,250.00` — symbol, space, thousands separator, two decimals.
- Every async surface needs loading, empty, and error states, with skeletons that match
  the layout's shape.
- Do not rely on colour alone for status — pair it with text and an icon.
- Verify a dependency exists in `package.json` before importing it.

## Copy & tone

- Plain, specific, contextual. No AI clichés.
- CTA labels: 2–4 words max. Examples: `Send`, `Add Money`, `Pay`, `Cancel`.
- Insights: one sentence max. Example: "You spent 12% less on dining this week."
- Success: "Sent KES 1,250.00 to Alice."
- Error: "Couldn't send. Check your balance and try again."
- Name the cause and the fix in an error the user can act on. "Not found" alone sends
  people hunting for the wrong bug; say which condition failed.

## When reviewing

Flag violations as: **[design] rule broken — file:line — expected pattern from <the
surface's source of truth>**.

If code and the source of truth genuinely disagree, say so and propose the doc change
rather than drifting silently. If the *two systems* disagree about which governs a
surface, that is a decision for the user — surface it, do not resolve it by preference.
