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
- Every async surface needs loading, empty, and error states, with skeletons that match the
  layout's shape — **except a surface with no account behind it**, which says so in words
  (`Sign in to see your balance.`) and invents nothing: no `0`, no placeholder figure, no
  skeleton (a skeleton claims data is coming for an account nobody confirmed), and no
  account-scoped request.
- Ask for an account at the ACTION, not at the door: a browse surface keeps the product's
  shape and the entry points to a money flow stay visible and tappable, while the sign-in
  affordance appears where the flow would have opened. The rail's identity card is the one
  place a visitor signs in.
- Do not rely on colour alone for status — pair it with text and an icon.
- **A status role names an INK token, never a fill accent, and an ink resolves per canvas.**
  The `accent-*` values are fills — mockups, borders, chrome — chosen to read on black, so
  using one as text on a white band is the classic sub-AA bug (an audit found four). Text
  roles point at `--color-ink-*`, which `globals.css` re-points per canvas, so the same role
  is legible on a white band and on the dark receipt card. Repointing one outright breaks the
  other: the receipt's status line falls to 2.10:1. `npm run check:ink` asserts both halves,
  and it bites — setting a text grade back to its fill value fails with the original ratio.
- **Texture belongs to chrome, not content.** The grain (`--app-grain-*` on the rail and the
  mobile bar; the landing's `--field-grain-*` on its bands) is for large flat surfaces with
  display-scale text. Over dense 13px rows it muddies them, and over already-marginal ink it
  spends contrast the app has not got. Half the landing's strength, and never animated.
- Verify a dependency exists in `package.json` before importing it.
- **The brand mark is a component, and its expression is a ROLE.** `BrandMark`
  (`components/ui/BrandMark.tsx`) takes `expression` and `canvas` as props; never hand a
  `src` path to an `<img>`. `neutral` identifies (chrome, receipts, legal, the tab, the
  app icon, warnings), `friendly` addresses a person (sign-in, onboarding, empty states, a
  payment that worked). `canvas` follows the surface's own canvas token, because the cream
  mark is 1.3:1 on white. The role map, the four files and the generator live in
  `design-kit/seti.live/marks/README.md` — that is the owning document, this is the pointer.

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
